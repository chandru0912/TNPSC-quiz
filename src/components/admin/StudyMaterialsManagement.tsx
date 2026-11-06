import React, { useState, useEffect, useMemo, useRef } from 'react';
import { dynamicSyllabusService } from '../../services/dynamicSyllabusService';
import { getApiUrl } from '../../utils/api';

const apiFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (typeof input === 'string') {
    return fetch(getApiUrl(input), init);
  }
  return fetch(input, init);
};
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  BookOpen,
  FileText,
  Search,
  RefreshCw,
  FolderPlus,
  FilePlus,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  GraduationCap,
  FileCheck,
  Tag,
  Sparkles,
  UploadCloud,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';
import './StudyMaterialsManagement.css';

export interface TextbookOption {
  id: number;
  fileName: string;
  googleDriveFileId: string;
  standard: number;
  subject: string;
  term: string;
  fileSize: number;
  fileSizeFormatted: string;
  totalPages: number;
  hasExtractedText: boolean;
  extractionStatus: string;
}

export interface MatchedLessonDraft {
  id: string;
  textbook_material_id: number;
  textbook_file_name: string;
  google_drive_file_id: string;
  standard_number: number;
  subject: string;
  term: string;
  textbook_unit_title?: string;
  lesson_number: string;
  lesson_title: string;
  matching_reason: string;
  confidence_score: number;
  is_already_in_db: boolean;
  selected: boolean;
  topics: Array<{ topic_name: string; display_order: number }>;
}

export interface ExtractedTopicDraft {
  topic_name: string;
  description?: string;
  display_order: number;
}

export interface ExtractedLessonDraft {
  lesson_number: string;
  title: string;
  standard_number: number;
  term?: string;
  description?: string;
  topics: ExtractedTopicDraft[];
}

export interface ExtractedUnitDraft {
  unit_number: number;
  unit_code: string;
  title: string;
  subject_slug?: string;
  subject_name?: string;
  standard_reference?: string;
  description?: string;
  question_count?: number;
  is_existing?: boolean;
  selected_for_publish?: boolean;
  lessons: ExtractedLessonDraft[];
}

export interface SyllabusAnalysisResult {
  exam_id: string;
  exam_name: string;
  subject_slug: string;
  subject_name: string;
  total_units: number;
  total_lessons: number;
  total_topics: number;
  extracted_text_preview: string;
  parsing_mode: 'ai_cloud' | 'structural_parser';
  units: ExtractedUnitDraft[];
  existing_comparison: {
    existing_units_count: number;
    new_units_count: number;
    duplicate_units: string[];
  };
}

const CANONICAL_EXAMS: ExamItem[] = [
  { id: 'group1', name: 'TNPSC Group 1', display_order: 1 },
  { id: 'group2', name: 'TNPSC Group 2', display_order: 2 },
  { id: 'group2a', name: 'TNPSC Group 2A', display_order: 3 },
  { id: 'group4', name: 'TNPSC Group 4', display_order: 4 },
];

const CANONICAL_EXAM_ORDER: Record<string, number> = {
  group1: 1,
  group2: 2,
  group2a: 3,
  group4: 4,
};

interface ExamItem {
  id: string;
  name: string;
  code?: string;
  badge?: string;
  description?: string;
  display_order: number;
}

interface SubjectItem {
  id: number;
  exam_id: string;
  subject_slug: string;
  name: string;
  description?: string;
  display_order: number;
}

interface TopicItem {
  id: number;
  lesson_id: string;
  unit_id: number;
  topic_name: string;
  description?: string;
  display_order: number;
  has_notes?: boolean;
  notes_count?: number;
}

interface LessonItem {
  id: string;
  unit_id: number;
  exam_id: string;
  subject_id: string;
  standard_number: number;
  lesson_number: string;
  title: string;
  term?: string;
  description?: string;
  status: string;
  display_order: number;
  topics?: TopicItem[];
  has_notes?: boolean;
}

interface UnitItem {
  id: number;
  exam_id: string;
  subject_id: string;
  unit_number: number;
  unit_code: string;
  title: string;
  subject_name?: string;
  description?: string;
  question_count?: number;
  display_order: number;
  lessons?: LessonItem[];
}

interface Props {
  token: string;
}

export const StudyMaterialsManagement: React.FC<Props> = ({ token }) => {
  // Navigation / Filter State
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('group1');
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectSlug, setSelectedSubjectSlug] = useState<string>('general-studies');
  const [selectedStandard, setSelectedStandard] = useState<number | null>(null); // null = all standards

  // Hierarchy Data
  const [tree, setTree] = useState<UnitItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Expand / Collapse state
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // AI Syllabus Import State
  const [aiImportModalOpen, setAiImportModalOpen] = useState<boolean>(false);
  const [aiImportStep, setAiImportStep] = useState<'upload' | 'analyzing' | 'review'>('upload');
  const [aiImportInputMode, setAiImportInputMode] = useState<'pdf' | 'text'>('pdf');
  const [aiImportExamId, setAiImportExamId] = useState<string>('group1');
  const [aiImportSubjectSlug, setAiImportSubjectSlug] = useState<string>('general-studies');
  const [aiImportFile, setAiImportFile] = useState<File | null>(null);
  const [aiImportPastedText, setAiImportPastedText] = useState<string>('');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<SyllabusAnalysisResult | null>(null);
  const [editableUnits, setEditableUnits] = useState<ExtractedUnitDraft[]>([]);
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [aiImportError, setAiImportError] = useState<string | null>(null);
  const [expandedReviewUnits, setExpandedReviewUnits] = useState<Set<number>>(new Set());

  // Modals
  const [examModal, setExamModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: Partial<ExamItem> }>({
    open: false,
    mode: 'add',
    data: {},
  });

  const [subjectModal, setSubjectModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: Partial<SubjectItem> }>({
    open: false,
    mode: 'add',
    data: {},
  });

  const [unitModal, setUnitModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: Partial<UnitItem> }>({
    open: false,
    mode: 'add',
    data: {},
  });

  const [lessonModal, setLessonModal] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    unitId: number;
    data: Partial<LessonItem>;
  }>({
    open: false,
    mode: 'add',
    unitId: 0,
    data: {},
  });

  // --- Textbook-Based AI Lesson Generation State ---
  const [lessonModalTab, setLessonModalTab] = useState<'ai_textbook' | 'manual'>('ai_textbook');
  const [tbStandard, setTbStandard] = useState<number>(10);
  const [tbSubject, setTbSubject] = useState<string>('all');
  const [tbTerm, setTbTerm] = useState<string>('all');
  const [tbSearch, setTbSearch] = useState<string>('');
  const [tbTopicsInput, setTbTopicsInput] = useState<string>('');
  const [availableTextbooks, setAvailableTextbooks] = useState<TextbookOption[]>([]);
  const [selectedTextbookIds, setSelectedTextbookIds] = useState<number[]>([]);
  const [isLoadingTextbooks, setIsLoadingTextbooks] = useState<boolean>(false);
  const [aiMatchingStep, setAiMatchingStep] = useState<'select' | 'matching' | 'review'>('select');
  const [matchingStatusMessage, setMatchingStatusMessage] = useState<string>('');
  const [matchedLessons, setMatchedLessons] = useState<MatchedLessonDraft[]>([]);
  const [isSavingMatchedLessons, setIsSavingMatchedLessons] = useState<boolean>(false);
  const aiMatchingAbortRef = useRef<AbortController | null>(null);

  const [topicModal, setTopicModal] = useState<{
    open: boolean;
    mode: 'add' | 'edit';
    lessonId: string;
    unitId: number;
    data: Partial<TopicItem>;
  }>({
    open: false,
    mode: 'add',
    lessonId: '',
    unitId: 0,
    data: {},
  });

  const [noteModal, setNoteModal] = useState<{
    open: boolean;
    topicId?: number;
    lessonId: string;
    unitId: number;
    standardNumber: number;
    topicName: string;
    lessonTitle: string;
    content: string;
    preview: boolean;
    submitting: boolean;
  }>({
    open: false,
    lessonId: '',
    unitId: 0,
    standardNumber: 6,
    topicName: '',
    lessonTitle: '',
    content: '',
    preview: false,
    submitting: false,
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    type: 'exam' | 'subject' | 'unit' | 'lesson' | 'topic';
    id: any;
    name: string;
    dependencies?: { lessons: number; topics: number; notes: number; questions: number } | null;
    loadingDeps?: boolean;
    submitting?: boolean;
  }>({
    open: false,
    type: 'unit',
    id: null,
    name: '',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Fetch Exams - Guarantees Canonical 4 Options in Exact Order: Group 1, Group 2, Group 2A, Group 4
  const fetchExams = async () => {
    try {
      const res = await apiFetch('/api/study-management/exams');
      const data = await res.json();
      if (data.success && Array.isArray(data.exams)) {
        // Filter strictly to the 3 canonical exams and normalize names without descriptions/badges
        const allowedIds = new Set(['group1', 'group2', 'group4']);
        const validExams: ExamItem[] = data.exams
          .filter((e: any) => allowedIds.has(e.id))
          .map((e: any) => ({
            ...e,
            name: e.id === 'group2' ? 'TNPSC Group 2, 2A' : (e.id === 'group1' ? 'TNPSC Group 1' : (e.id === 'group4' ? 'TNPSC Group 4' : e.name)),
            badge: undefined,
            description: undefined,
          }));

        const existingIds = new Set(validExams.map((e) => e.id));

        // Ensure all canonical exams are present
        CANONICAL_EXAMS.forEach((c) => {
          if (!existingIds.has(c.id)) {
            validExams.push(c);
          }
        });

        // Strict Canonical Order Sort:
        // 1. TNPSC Group 1 (group1)
        // 2. TNPSC Group 2, 2A (group2)
        // 3. TNPSC Group 4 (group4)
        validExams.sort((a, b) => {
          const ordA = CANONICAL_EXAM_ORDER[a.id] ?? (a.display_order || 99);
          const ordB = CANONICAL_EXAM_ORDER[b.id] ?? (b.display_order || 99);
          return ordA - ordB;
        });

        setExams(validExams);
        if (validExams.length > 0 && (!selectedExamId || selectedExamId === 'group2a' || !validExams.some((e) => e.id === selectedExamId))) {
          setSelectedExamId(validExams[0].id);
        }
      } else {
        setExams(CANONICAL_EXAMS);
      }
    } catch (err: any) {
      console.error('Failed to load exams', err);
      setExams(CANONICAL_EXAMS);
    }
  };

  // Sample syllabus text for 1-click test fill
  const SAMPLE_TNPSC_SYLLABUS = `UNIT-I: GENERAL SCIENCE
(i) Scientific Knowledge and Scientific Temper - Power of Reasoning - Rote Learning vs Conceptual Learning - Science as a tool to understand the past, present and future.
(ii) Nature of Universe - General Scientific Laws – Mechanics - Properties of Matter, Force, Motion and Energy - Everyday application of the basic principles of Mechanics, Electricity and Magnetism, Light, Sound, Heat, Nuclear Physics, Laser, Electronics and Communications.
(iii) Elements and Compounds, Acids, Bases, Salts, Petroleum Products, Fertilizers, Pesticides.
(iv) Main concepts of Life Science, Classification of Living Organisms, Evolution, Genetics, Physiology, Nutrition, Health and Hygiene, Human diseases.
(v) Environment and Ecology.

UNIT-II: CURRENT EVENTS
(i) History - Latest diary of events - National symbols - Profile of States - Eminent personalities and places in news - Sports - Books and authors.
(ii) Polity - Political parties and political system in India - Public awareness and General administration - Welfare oriented Government schemes and their utility, Problems in Public Delivery Systems.
(iii) Geography - Geographical landmarks.
(iv) Economics - Current socio-economic issues.
(v) Science and Technology - Latest inventions in Science and Technology.`;

  // AI Syllabus Import Handlers
  const handleOpenAiImport = () => {
    setAiImportExamId(selectedExamId || 'group1');
    setAiImportSubjectSlug('all'); // Universal default - processes all units & subjects
    setAiImportInputMode('pdf');
    setAiImportFile(null);
    setAiImportPastedText('');
    setAiAnalysisResult(null);
    setEditableUnits([]);
    setOverwriteExisting(false);
    setAiImportError(null);
    setAiImportStep('upload');
    setAiImportModalOpen(true);
  };

  const handleStartAnalysis = async () => {
    if (aiImportInputMode === 'pdf') {
      if (!aiImportFile) {
        setAiImportError('Please select or drop a valid TNPSC syllabus PDF file.');
        return;
      }
    } else {
      if (!aiImportPastedText || aiImportPastedText.trim().length < 30) {
        setAiImportError('Please paste syllabus text containing at least 30 characters (with Units and Lessons).');
        return;
      }
    }

    setAiImportStep('analyzing');
    setAiImportError(null);

    try {
      const authToken = token || localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
      let res: Response;

      if (aiImportInputMode === 'pdf') {
        const formData = new FormData();
        formData.append('pdf', aiImportFile!);
        formData.append('examId', aiImportExamId);
        formData.append('subjectId', aiImportSubjectSlug);

        res = await apiFetch('/api/study-management/ai-syllabus/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        });
      } else {
        res = await apiFetch('/api/study-management/ai-syllabus/analyze-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            syllabusText: aiImportPastedText,
            examId: aiImportExamId,
            subjectId: aiImportSubjectSlug,
          }),
        });
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to extract and analyze syllabus.');
      }

      setAiAnalysisResult(data);
      const units: ExtractedUnitDraft[] = (data.units || []).map((u: any) => ({
        ...u,
        selected_for_publish: true,
      }));
      setEditableUnits(units);

      // Auto-expand all units in review
      const allUnitNums = new Set<number>(units.map((u, idx) => u.unit_number || idx + 1));
      setExpandedReviewUnits(allUnitNums);

      // If duplicate units exist, set default overwrite based on duplicates
      if (data.existing_comparison?.duplicate_units?.length > 0) {
        setOverwriteExisting(false);
      }

      setAiImportStep('review');
    } catch (err: any) {
      console.error('[AISyllabus] Analysis error:', err);
      let errMsg = err.message || 'Failed to analyze syllabus.';
      if (errMsg.includes('Failed to fetch') || err.name === 'TypeError') {
        errMsg = 'Connection Error: Unable to reach backend server. Please ensure the backend server is running on http://localhost:5000.';
      }
      setAiImportError(errMsg);
      setAiImportStep('upload');
    }
  };

  const handlePublishApprovedSyllabus = async (singleUnit?: ExtractedUnitDraft) => {
    const unitsToPublish = singleUnit
      ? [singleUnit]
      : editableUnits.filter((u) => u.selected_for_publish !== false);

    if (unitsToPublish.length === 0) {
      showToast('No units selected for publishing. Check at least one unit.', 'error');
      return;
    }

    setIsPublishing(true);
    try {
      const authToken = token || localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
      const res = await apiFetch('/api/study-management/ai-syllabus/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          examId: aiImportExamId,
          subjectSlug: aiImportSubjectSlug,
          subjectName: aiAnalysisResult?.subject_name || 'Complete Syllabus',
          units: unitsToPublish,
          overwriteExisting,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to publish syllabus.');
      }

      showToast(data.message || 'Syllabus approved and published successfully!', 'success');
      dynamicSyllabusService.notifySyllabusChanged('published', { examId: aiImportExamId, subjectSlug: aiImportSubjectSlug });

      if (!singleUnit || unitsToPublish.length === editableUnits.length) {
        setAiImportModalOpen(false);
      } else {
        // Mark published unit
        setEditableUnits((prev) =>
          prev.map((u) =>
            u.unit_number === singleUnit.unit_number && u.subject_slug === singleUnit.subject_slug
              ? { ...u, is_existing: true }
              : u
          )
        );
      }

      // Switch active exam & subject to the imported one immediately
      setSelectedExamId(aiImportExamId);
      if (singleUnit?.subject_slug) {
        setSelectedSubjectSlug(singleUnit.subject_slug);
      } else if (aiImportSubjectSlug !== 'all') {
        setSelectedSubjectSlug(aiImportSubjectSlug);
      }
      setSelectedStandard(null);

      // Re-fetch tree to immediately reflect in existing Admin Panel and Student view
      fetchSubjects(aiImportExamId);
      fetchTree();
    } catch (err: any) {
      console.error('[AISyllabus] Publish error:', err);
      let errMsg = err.message || 'Failed to publish syllabus.';
      if (errMsg.includes('Failed to fetch') || err.name === 'TypeError') {
        errMsg = 'Connection Error: Unable to reach backend server. Please ensure the backend server is running on http://localhost:5000.';
      }
      showToast(errMsg, 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // Bulk & unit selection helpers
  const handleToggleSelectAll = (select: boolean) => {
    setEditableUnits((prev) => prev.map((u) => ({ ...u, selected_for_publish: select })));
  };

  const handleToggleSelectUnit = (uIdx: number) => {
    setEditableUnits((prev) => {
      const updated = [...prev];
      const cur = updated[uIdx].selected_for_publish !== false;
      updated[uIdx] = { ...updated[uIdx], selected_for_publish: !cur };
      return updated;
    });
  };

  const expandAllReview = () => {
    const allNums = new Set<number>(editableUnits.map((u, idx) => u.unit_number || idx + 1));
    setExpandedReviewUnits(allNums);
  };

  const collapseAllReview = () => {
    setExpandedReviewUnits(new Set());
  };

  // Review tree editing helpers
  const toggleReviewUnit = (unitNum: number) => {
    setExpandedReviewUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitNum)) next.delete(unitNum);
      else next.add(unitNum);
      return next;
    });
  };

  const updateUnitField = (uIdx: number, field: keyof ExtractedUnitDraft, val: any) => {
    setEditableUnits((prev) => {
      const updated = [...prev];
      updated[uIdx] = { ...updated[uIdx], [field]: val };
      return updated;
    });
  };

  const removeUnitDraft = (uIdx: number) => {
    setEditableUnits((prev) => prev.filter((_, idx) => idx !== uIdx));
  };

  const addUnitDraft = () => {
    const nextNum = editableUnits.length + 1;
    setEditableUnits((prev) => [
      ...prev,
      {
        unit_number: nextNum,
        unit_code: `Unit ${nextNum}`,
        title: `New Unit ${nextNum}`,
        question_count: 15,
        lessons: [
          {
            lesson_number: `${nextNum}.1`,
            title: `Introductory Topics`,
            standard_number: 10,
            topics: [{ topic_name: 'Core Overview', display_order: 1 }],
          },
        ],
      },
    ]);
  };

  const updateLessonField = (uIdx: number, lIdx: number, field: keyof ExtractedLessonDraft, val: any) => {
    setEditableUnits((prev) => {
      const updated = [...prev];
      const lessons = [...updated[uIdx].lessons];
      lessons[lIdx] = { ...lessons[lIdx], [field]: val };
      updated[uIdx] = { ...updated[uIdx], lessons };
      return updated;
    });
  };

  const removeLessonDraft = (uIdx: number, lIdx: number) => {
    setEditableUnits((prev) => {
      const updated = [...prev];
      const lessons = updated[uIdx].lessons.filter((_, idx) => idx !== lIdx);
      updated[uIdx] = { ...updated[uIdx], lessons };
      return updated;
    });
  };

  const addLessonDraft = (uIdx: number) => {
    setEditableUnits((prev) => {
      const updated = [...prev];
      const u = updated[uIdx];
      const nextLNum = `${u.unit_number}.${u.lessons.length + 1}`;
      const lessons = [
        ...u.lessons,
        {
          lesson_number: nextLNum,
          title: `Lesson ${nextLNum}`,
          standard_number: 10,
          topics: [{ topic_name: 'Overview', display_order: 1 }],
        },
      ];
      updated[uIdx] = { ...u, lessons };
      return updated;
    });
  };

  const updateTopicDraft = (uIdx: number, lIdx: number, tIdx: number, val: string) => {
    setEditableUnits((prev) => {
      const updated = [...prev];
      const lessons = [...updated[uIdx].lessons];
      const topics = [...lessons[lIdx].topics];
      topics[tIdx] = { ...topics[tIdx], topic_name: val };
      lessons[lIdx] = { ...lessons[lIdx], topics };
      updated[uIdx] = { ...updated[uIdx], lessons };
      return updated;
    });
  };

  const removeTopicDraft = (uIdx: number, lIdx: number, tIdx: number) => {
    setEditableUnits((prev) => {
      const updated = [...prev];
      const lessons = [...updated[uIdx].lessons];
      const topics = lessons[lIdx].topics.filter((_, idx) => idx !== tIdx);
      lessons[lIdx] = { ...lessons[lIdx], topics };
      updated[uIdx] = { ...updated[uIdx], lessons };
      return updated;
    });
  };

  const addTopicDraft = (uIdx: number, lIdx: number) => {
    setEditableUnits((prev) => {
      const updated = [...prev];
      const lessons = [...updated[uIdx].lessons];
      const topics = [
        ...lessons[lIdx].topics,
        { topic_name: 'New Subtopic', display_order: lessons[lIdx].topics.length + 1 },
      ];
      lessons[lIdx] = { ...lessons[lIdx], topics };
      updated[uIdx] = { ...updated[uIdx], lessons };
      return updated;
    });
  };

  // 2. Fetch Subjects for active Exam
  const fetchSubjects = async (examId: string) => {
    try {
      const res = await apiFetch(`/api/study-management/subjects?examId=${encodeURIComponent(examId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.subjects)) {
        setSubjects(data.subjects);
        if (data.subjects.length > 0) {
          const match = data.subjects.find((s: any) => s.subject_slug === selectedSubjectSlug);
          if (!match) {
            setSelectedSubjectSlug(data.subjects[0].subject_slug);
          }
        } else {
          setSelectedSubjectSlug('general-studies');
        }
      }
    } catch (err: any) {
      console.error('Failed to load subjects', err);
    }
  };

  // 3. Fetch Tree
  const fetchTree = async () => {
    try {
      setRefreshing(true);
      const url = `/api/study-management/tree?examId=${encodeURIComponent(selectedExamId)}&subjectId=${encodeURIComponent(
        selectedSubjectSlug
      )}${selectedStandard ? `&standardId=${selectedStandard}` : ''}`;
      const res = await apiFetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.tree)) {
        setTree(data.tree);
        // Expand all units by default if newly loaded
        const allUnitIds = new Set<number>(data.tree.map((u: UnitItem) => u.id));
        setExpandedUnits(allUnitIds);
      }
    } catch (err: any) {
      console.error('Failed to load hierarchy tree', err);
      showToast('Error loading study materials tree', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      fetchSubjects(selectedExamId);
    }
  }, [selectedExamId]);

  useEffect(() => {
    if (selectedExamId && selectedSubjectSlug) {
      fetchTree();
    }
  }, [selectedExamId, selectedSubjectSlug, selectedStandard]);

  // Expand / Collapse Toggles
  const toggleUnit = (unitId: number) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const toggleLesson = (lessonId: string) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  const expandAll = () => {
    const allUnitIds = new Set<number>(tree.map((u) => u.id));
    const allLessonIds = new Set<string>();
    tree.forEach((u) => u.lessons?.forEach((l) => allLessonIds.add(l.id)));
    setExpandedUnits(allUnitIds);
    setExpandedLessons(allLessonIds);
  };

  const collapseAll = () => {
    setExpandedUnits(new Set());
    setExpandedLessons(new Set());
  };

  // Statistics
  const stats = useMemo(() => {
    let unitsCount = tree.length;
    let lessonsCount = 0;
    let topicsCount = 0;
    let notesCount = 0;

    tree.forEach((unit) => {
      if (unit.lessons) {
        lessonsCount += unit.lessons.length;
        unit.lessons.forEach((l) => {
          if (l.has_notes) notesCount++;
          if (l.topics) {
            topicsCount += l.topics.length;
            l.topics.forEach((t) => {
              if (t.has_notes) notesCount++;
            });
          }
        });
      }
    });

    return { unitsCount, lessonsCount, topicsCount, notesCount };
  }, [tree]);

  // Filtered Tree based on Search Term
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return tree;
    const term = searchTerm.toLowerCase();

    return tree
      .map((unit) => {
        const unitMatch = unit.title.toLowerCase().includes(term) || unit.unit_code.toLowerCase().includes(term);
        const filteredLessons = (unit.lessons || []).filter((lesson) => {
          const lessonMatch =
            lesson.title.toLowerCase().includes(term) ||
            lesson.lesson_number.toLowerCase().includes(term) ||
            `class ${lesson.standard_number}`.includes(term);
          const topicMatch = lesson.topics?.some((t) => t.topic_name.toLowerCase().includes(term));
          return lessonMatch || topicMatch;
        });

        if (unitMatch) return unit;
        if (filteredLessons.length > 0) {
          return { ...unit, lessons: filteredLessons };
        }
        return null;
      })
      .filter((u): u is UnitItem => u !== null);
  }, [tree, searchTerm]);

  // =========================================================================
  // HANDLERS: CREATE / EDIT / DELETE ACTIONS
  // =========================================================================

  // --- EXAM ---
  const handleSaveExam = async () => {
    const { id, name, code, badge, description, display_order } = examModal.data;
    if (!id || !name) {
      showToast('Exam ID and Name are required', 'error');
      return;
    }
    try {
      const isEdit = examModal.mode === 'edit';
      const endpoint = isEdit ? `/api/study-management/exams/${id}` : '/api/study-management/exams';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, name, code, badge, description, display_order: display_order || 1 }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? 'Exam updated successfully' : 'New exam added successfully');
        setExamModal({ open: false, mode: 'add', data: {} });
        fetchExams();
      } else {
        showToast(data.message || 'Operation failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // --- SUBJECT ---
  const handleSaveSubject = async () => {
    const { subject_slug, name, description, display_order } = subjectModal.data;
    if (!subject_slug || !name) {
      showToast('Subject Slug and Name are required', 'error');
      return;
    }
    try {
      const isEdit = subjectModal.mode === 'edit';
      const endpoint = isEdit
        ? `/api/study-management/subjects/${subjectModal.data.id}`
        : '/api/study-management/subjects';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exam_id: selectedExamId,
          subject_slug,
          name,
          description,
          display_order: display_order || 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? 'Subject updated' : 'New subject added');
        setSubjectModal({ open: false, mode: 'add', data: {} });
        fetchSubjects(selectedExamId);
      } else {
        showToast(data.message || 'Operation failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // --- UNIT ---
  const handleOpenAddUnit = () => {
    const maxUnit = tree.reduce((max, u) => Math.max(max, u.unit_number || 0), 0);
    const nextNum = maxUnit + 1;
    setUnitModal({
      open: true,
      mode: 'add',
      data: {
        unit_number: nextNum,
        unit_code: `Unit ${nextNum}`,
        title: '',
        question_count: 20,
        description: '',
      },
    });
  };

  const handleSaveUnit = async () => {
    const { unit_number, unit_code, title, question_count, description } = unitModal.data;
    if (unit_number == null || !title) {
      showToast('Unit number and title are required', 'error');
      return;
    }
    try {
      const isEdit = unitModal.mode === 'edit';
      const endpoint = isEdit ? `/api/study-management/units/${unitModal.data.id}` : '/api/study-management/units';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exam_id: selectedExamId,
          subject_id: selectedSubjectSlug,
          unit_number: Number(unit_number),
          unit_code: unit_code || `Unit ${unit_number}`,
          title,
          question_count: question_count || 0,
          description,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? 'Unit updated' : `Unit ${unit_number} added dynamically!`);
        dynamicSyllabusService.notifySyllabusChanged('unit_saved', { examId: selectedExamId });
        setUnitModal({ open: false, mode: 'add', data: {} });
        fetchTree();
      } else {
        showToast(data.message || 'Operation failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // --- TEXTBOOK-BASED AI LESSON HELPER FUNCTIONS ---
  const fetchAvailableTextbooks = async (std?: number, subj?: string, termVal?: string, search?: string) => {
    try {
      setIsLoadingTextbooks(true);
      const params = new URLSearchParams();
      if (std) params.append('standard', String(std));
      if (subj && subj !== 'all') params.append('subject', subj);
      if (termVal && termVal !== 'all') params.append('term', termVal);
      if (search && search.trim()) params.append('search', search.trim());

      const res = await apiFetch(`/api/study-management/textbooks?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.textbooks)) {
        setAvailableTextbooks(data.textbooks);
        if (data.textbooks.length > 0) {
          setSelectedTextbookIds([data.textbooks[0].id]);
        } else {
          setSelectedTextbookIds([]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load textbooks', err);
    } finally {
      setIsLoadingTextbooks(false);
    }
  };

  const handleOpenAddLesson = (unitId: number) => {
    const targetUnit = tree.find((u) => u.id === unitId);
    const uNum = targetUnit?.unit_number || 1;
    const uTitle = targetUnit?.title || '';

    // Smart default syllabus topics based on TNPSC Unit
    let suggestedTopics = '';
    const uTitleLower = uTitle.toLowerCase();
    if (uTitleLower.includes('science') || uNum === 1) {
      suggestedTopics = 'Scientific Knowledge and Scientific Temper, Nature of Universe, Mechanics, Properties of Matter, Force, Motion and Energy, Electricity and Magnetism, Light, Sound, Heat, Nuclear Physics, Elements and Compounds, Acids, Bases, Salts, Petroleum Products, Fertilizers, Pesticides, Life Science, Nutrition and Dietetics, Human Diseases, Environment and Ecology';
    } else if (uTitleLower.includes('geography') || uNum === 2) {
      suggestedTopics = 'Location, Physical Features, Monsoon, Rainfall, Weather and Climate, Water Resources, Rivers in India, Soil, Minerals and Natural Resources, Forest and Wildlife, Agriculture, Transport and Communication, Social Geography, Population Density, Major Tribes, Natural Calamities, Disaster Management, Environmental Pollution, Climate Change';
    } else if (uTitleLower.includes('history') || uTitleLower.includes('inm') || uNum === 3) {
      suggestedTopics = 'Indus Valley Civilization, Guptas, Delhi Sultans, Mughals, Marathas, Vijayanagara and Bahmani Kingdoms, South Indian History, Indian Culture, Unity in Diversity, Secular State, National Renaissance, Early Uprising Against British Rule, 1857 Revolt, Indian National Congress, Freedom Movement Leaders, Gandhian Era, Partition of Bengal';
    } else if (uTitleLower.includes('polity') || uNum === 4) {
      suggestedTopics = 'Constitution of India, Preamble, Salient Features, Union, State and Union Territory, Citizenship, Fundamental Rights, Fundamental Duties, Directive Principles of State Policy, Union Executive, Parliament, State Government, Local Governments, Panchayat Raj, Judiciary, Rule of Law, Anti-Corruption, Lokpal, RTI';
    } else if (uTitleLower.includes('economy') || uNum === 5) {
      suggestedTopics = 'Nature of Indian Economy, Five Year Plans, NITI Aayog, Reserve Bank of India, Fiscal Policy, Monetary Policy, Finance Commission, GST, Agriculture, Land Reforms, Industrial Growth, Rural Welfare Programmes, Employment, Poverty, Social Problems';
    } else if (uTitleLower.includes('tamil') || uTitleLower.includes('heritage') || uNum === 6) {
      suggestedTopics = 'History of Tamil Society, Archaeological Discoveries, Sangam Literature, Thirukkural, Secular Literature, Impact on Humanity, Role of Tamil Nadu in Freedom Struggle, Early Agitations Against British Rule, Women in Freedom Struggle, Social Reformers, Periyar EVR, Justice Party, Self-Respect Movement';
    } else {
      suggestedTopics = targetUnit?.description || uTitle;
    }

    setTbTopicsInput(suggestedTopics);
    setLessonModalTab('ai_textbook');
    setAiMatchingStep('select');
    setMatchedLessons([]);
    setSelectedTextbookIds([]);
    setTbSearch('');

    let defaultStd = selectedStandard || 10;
    let defaultSubject = 'all';
    if (uTitleLower.includes('science')) {
      defaultSubject = 'Science';
    } else if (
      uTitleLower.includes('geography') ||
      uTitleLower.includes('history') ||
      uTitleLower.includes('polity') ||
      uTitleLower.includes('economy')
    ) {
      defaultSubject = 'Social Science';
    }
    setTbStandard(defaultStd);
    setTbSubject(defaultSubject);
    setTbTerm('all');

    setLessonModal({
      open: true,
      mode: 'add',
      unitId,
      data: {
        standard_number: defaultStd,
        lesson_number: '1',
        title: '',
        term: 'Term 1',
        status: 'Available',
        description: '',
      },
    });

    fetchAvailableTextbooks(defaultStd, defaultSubject, 'all');
  };

  const handleRunAiLessonMatching = async () => {
    if (selectedTextbookIds.length === 0) {
      showToast('Please select at least one textbook PDF from Google Drive.', 'error');
      return;
    }
    if (!tbTopicsInput.trim()) {
      showToast('Please enter or verify the TNPSC syllabus topics.', 'error');
      return;
    }

    const targetUnit = tree.find((u) => u.id === lessonModal.unitId);
    if (!targetUnit) {
      showToast('Target unit not found.', 'error');
      return;
    }

    const controller = new AbortController();
    aiMatchingAbortRef.current = controller;

    const abortTimeout = setTimeout(() => {
      controller.abort();
    }, 25000);

    const timer1 = setTimeout(() => {
      setMatchingStatusMessage('Reading textbook chapters & curriculum index...');
    }, 1500);

    const timer2 = setTimeout(() => {
      setMatchingStatusMessage('Comparing textbook lessons with syllabus topics via AI...');
    }, 3500);

    try {
      setAiMatchingStep('matching');
      setMatchingStatusMessage('Connecting to Google Drive textbook PDFs & extracting chapter index...');

      const authToken = token || localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
      const res = await apiFetch('/api/study-management/match-textbook-lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          unitId: targetUnit.id,
          unitNumber: targetUnit.unit_number,
          unitTitle: targetUnit.title,
          examId: selectedExamId,
          subjectId: selectedSubjectSlug,
          standard: tbStandard,
          subject: tbSubject,
          term: tbTerm,
          tnpscTopics: tbTopicsInput,
          materialIds: selectedTextbookIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to match textbook lessons with AI.');
      }

      setMatchedLessons(data.matchedLessons || []);
      setAiMatchingStep('review');
      showToast(`AI matched ${data.matchedLessons?.length || 0} relevant lessons from textbooks!`, 'success');
    } catch (err: any) {
      console.error('[AI Matcher] Error:', err);
      if (err.name === 'AbortError') {
        showToast('Textbook matching timed out. Please try again with specific textbooks.', 'error');
      } else {
        showToast(err.message || 'Failed to analyze textbook lessons', 'error');
      }
      setAiMatchingStep('select');
    } finally {
      clearTimeout(abortTimeout);
      clearTimeout(timer1);
      clearTimeout(timer2);
      aiMatchingAbortRef.current = null;
    }
  };

  const handleSaveApprovedMatchedLessons = async () => {
    const selected = matchedLessons.filter((m) => m.selected);
    if (selected.length === 0) {
      showToast('Please select at least one lesson to save into this Unit.', 'error');
      return;
    }

    try {
      setIsSavingMatchedLessons(true);
      const authToken = token || localStorage.getItem('token') || localStorage.getItem('adminToken') || '';
      const res = await apiFetch('/api/study-management/save-textbook-lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          unitId: lessonModal.unitId,
          examId: selectedExamId,
          subjectId: selectedSubjectSlug,
          lessons: selected.map((m) => ({
            standard_number: m.standard_number,
            lesson_number: m.lesson_number,
            title: m.lesson_title,
            term: m.term,
            description: `${m.matching_reason} (Standard ${m.standard_number}, ${m.subject}, ${m.term})`,
            textbook_material_id: m.textbook_material_id,
            textbook_file_name: m.textbook_file_name,
            topics: m.topics,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save approved lessons.');
      }

      showToast(`Added ${data.savedCount} textbook lesson(s) to Unit! (${data.duplicatesSkipped} duplicates skipped)`, 'success');
      dynamicSyllabusService.notifySyllabusChanged('lesson_saved', { examId: selectedExamId });

      setLessonModal({ open: false, mode: 'add', unitId: 0, data: {} });
      fetchTree();
    } catch (err: any) {
      console.error('[Save Lessons] Error:', err);
      showToast(err.message || 'Failed to save lessons', 'error');
    } finally {
      setIsSavingMatchedLessons(false);
    }
  };

  // --- LESSON (MANUAL SAVE) ---
  const handleSaveLesson = async () => {
    const { unitId, mode } = lessonModal;
    const { standard_number, lesson_number, title, term, description, status } = lessonModal.data;
    if (!title || !lesson_number) {
      showToast('Lesson title and number are required', 'error');
      return;
    }
    try {
      const isEdit = mode === 'edit';
      const endpoint = isEdit
        ? `/api/study-management/lessons/${lessonModal.data.id}`
        : '/api/study-management/lessons';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          unit_id: unitId,
          exam_id: selectedExamId,
          subject_id: selectedSubjectSlug,
          standard_number: Number(standard_number || 6),
          lesson_number,
          title,
          term: term || 'Term 1',
          description,
          status: status || 'Available',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? 'Lesson updated' : 'New lesson created under unit!');
        dynamicSyllabusService.notifySyllabusChanged('lesson_saved', { examId: selectedExamId });
        setLessonModal({ open: false, mode: 'add', unitId: 0, data: {} });
        fetchTree();
      } else {
        showToast(data.message || 'Operation failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // --- TOPIC ---
  const handleOpenAddTopic = (lessonId: string, unitId: number) => {
    setTopicModal({
      open: true,
      mode: 'add',
      lessonId,
      unitId,
      data: {
        topic_name: '',
        description: '',
      },
    });
  };

  const handleSaveTopic = async () => {
    const { lessonId, unitId, mode } = topicModal;
    const { topic_name, description } = topicModal.data;
    if (!topic_name) {
      showToast('Topic name is required', 'error');
      return;
    }
    try {
      const isEdit = mode === 'edit';
      const endpoint = isEdit ? `/api/study-management/topics/${topicModal.data.id}` : '/api/study-management/topics';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lesson_id: lessonId,
          unit_id: unitId,
          topic_name,
          description,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isEdit ? 'Topic updated' : 'New topic added to lesson!');
        dynamicSyllabusService.notifySyllabusChanged('topic_saved', { lessonId });
        setTopicModal({ open: false, mode: 'add', lessonId: '', unitId: 0, data: {} });
        fetchTree();
      } else {
        showToast(data.message || 'Operation failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // --- STUDY NOTE UPLOAD / EDIT ---
  const handleOpenNoteModal = async (
    lesson: LessonItem,
    topicName: string,
    topicId?: number
  ) => {
    let existingContent = '';
    try {
      const url = topicId
        ? `/api/study-management/notes?topicId=${topicId}`
        : `/api/study-management/notes?lessonId=${lesson.id}`;
      const res = await apiFetch(url);
      const data = await res.json();
      if (data.success && data.notes && data.notes.length > 0) {
        existingContent = data.notes[0].content || data.notes[0].content_html || '';
      }
    } catch {
      // Ignore
    }

    setNoteModal({
      open: true,
      topicId,
      lessonId: lesson.id,
      unitId: lesson.unit_id,
      standardNumber: lesson.standard_number,
      topicName,
      lessonTitle: lesson.title,
      content: existingContent,
      preview: false,
      submitting: false,
    });
  };

  const handleSaveNote = async () => {
    if (!noteModal.content.trim()) {
      showToast('Note content cannot be empty', 'error');
      return;
    }
    setNoteModal((prev) => ({ ...prev, submitting: true }));
    try {
      const res = await apiFetch('/api/study-management/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic_id: noteModal.topicId,
          lesson_id: noteModal.lessonId,
          unit_id: noteModal.unitId,
          standard_number: noteModal.standardNumber,
          exam_id: selectedExamId,
          subject_id: selectedSubjectSlug,
          topic_name: noteModal.topicName,
          lesson_title: noteModal.lessonTitle,
          content: noteModal.content,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Study Note attached & published successfully!');
        setNoteModal((prev) => ({ ...prev, open: false, submitting: false }));
        fetchTree();
      } else {
        showToast(data.message || 'Failed to save note', 'error');
        setNoteModal((prev) => ({ ...prev, submitting: false }));
      }
    } catch (err: any) {
      showToast(err.message, 'error');
      setNoteModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // --- DELETE CONFIRMATION ---
  const closeDeleteConfirm = () => setDeleteConfirm({ open: false, type: 'unit', id: null, name: '' });

  // Opens the unit delete dialog and loads child-record counts from the database
  const openUnitDeleteConfirm = async (unit: { id: number; unit_code?: string; unit_number: number; title: string }) => {
    setDeleteConfirm({
      open: true,
      type: 'unit',
      id: unit.id,
      name: `${unit.unit_code || `Unit ${unit.unit_number}`}: ${unit.title}`,
      dependencies: null,
      loadingDeps: true,
    });
    try {
      const res = await apiFetch(`/api/study-management/units/${unit.id}/dependencies`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load unit contents.');
      setDeleteConfirm((prev) =>
        prev.open && prev.id === unit.id ? { ...prev, dependencies: data.dependencies, loadingDeps: false } : prev
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to load unit contents.', 'error');
      setDeleteConfirm((prev) => (prev.open && prev.id === unit.id ? { ...prev, loadingDeps: false } : prev));
    }
  };

  const handleExecuteDelete = async () => {
    const { type, id, name } = deleteConfirm;
    if (deleteConfirm.submitting || deleteConfirm.loadingDeps) return;
    setDeleteConfirm((prev) => ({ ...prev, submitting: true }));
    try {
      let endpoint = '';
      if (type === 'exam') endpoint = `/api/study-management/exams/${id}`;
      else if (type === 'subject') endpoint = `/api/study-management/subjects/${id}`;
      // The admin has reviewed the child-record warning in this dialog, so cascade explicitly.
      else if (type === 'unit') endpoint = `/api/study-management/units/${id}?force=true`;
      else if (type === 'lesson') endpoint = `/api/study-management/lessons/${id}`;
      else if (type === 'topic') endpoint = `/api/study-management/topics/${id}`;

      const res = await apiFetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const d = data.deleted;
        const detail =
          type === 'unit' && d ? ` (${d.lessons} lessons, ${d.topics} topics, ${d.notes} study notes removed)` : '';
        showToast(`${type === 'unit' ? `"${name}"` : type.toUpperCase()} deleted successfully${detail}`);
        dynamicSyllabusService.notifySyllabusChanged('deleted', { type, id });
        closeDeleteConfirm();
        if (type === 'exam') fetchExams();
        else if (type === 'subject') fetchSubjects(selectedExamId);
        else {
          fetchTree();
          fetchSubjects(selectedExamId);
        }
      } else {
        if (res.status === 404 && type === 'unit') {
          // Already gone server-side: resync UI so the stale card disappears
          closeDeleteConfirm();
          fetchTree();
        } else {
          setDeleteConfirm((prev) => ({ ...prev, submitting: false }));
        }
        showToast(data.message || `Delete failed (HTTP ${res.status})`, 'error');
      }
    } catch (err: any) {
      setDeleteConfirm((prev) => ({ ...prev, submitting: false }));
      showToast(err.message || 'Delete failed: unable to reach the server.', 'error');
    }
  };

  // --- REORDER HANDLERS (Section 2 Architecture) ---
  const handleMoveUnit = async (unitIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? unitIndex - 1 : unitIndex + 1;
    if (targetIndex < 0 || targetIndex >= filteredTree.length) return;

    const currentList = [...filteredTree];
    const temp = currentList[unitIndex];
    currentList[unitIndex] = currentList[targetIndex];
    currentList[targetIndex] = temp;

    const itemsToReorder = currentList.map((u, idx) => ({
      id: u.id,
      display_order: idx + 1,
    }));

    const ok = await dynamicSyllabusService.reorderUnits(itemsToReorder, token || undefined);
    if (ok) {
      showToast('Unit reordered successfully');
      fetchTree();
    } else {
      showToast('Failed to reorder unit', 'error');
    }
  };

  const handleMoveLesson = async (unitLessons: LessonItem[], lessonIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? lessonIndex - 1 : lessonIndex + 1;
    if (targetIndex < 0 || targetIndex >= unitLessons.length) return;

    const currentList = [...unitLessons];
    const temp = currentList[lessonIndex];
    currentList[lessonIndex] = currentList[targetIndex];
    currentList[targetIndex] = temp;

    const itemsToReorder = currentList.map((l, idx) => ({
      id: l.id,
      display_order: idx + 1,
    }));

    const ok = await dynamicSyllabusService.reorderLessons(itemsToReorder, token || undefined);
    if (ok) {
      showToast('Lesson reordered successfully');
      fetchTree();
    } else {
      showToast('Failed to reorder lesson', 'error');
    }
  };

  const handleMoveTopic = async (topics: TopicItem[], topicIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? topicIndex - 1 : topicIndex + 1;
    if (targetIndex < 0 || targetIndex >= topics.length) return;

    const currentList = [...topics];
    const temp = currentList[topicIndex];
    currentList[topicIndex] = currentList[targetIndex];
    currentList[targetIndex] = temp;

    const itemsToReorder = currentList.map((t, idx) => ({
      id: t.id,
      display_order: idx + 1,
    }));

    const ok = await dynamicSyllabusService.reorderTopics(itemsToReorder, token || undefined);
    if (ok) {
      showToast('Topic reordered successfully');
      fetchTree();
    } else {
      showToast('Failed to reorder topic', 'error');
    }
  };

  return (
    <div className="smm-wrapper">
      {/* Toast Notification */}
      {toast && (
        <div className={`smm-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* 1. Statistics HUD (4 Cards matching Admin Panel styling) */}
      <div className="admin-metrics-grid smm-kpi-row">
        <div className="admin-metric-card glass">
          <div className="metric-icon-box metric-icon-gold">
            <Layers size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats.unitsCount}</span>
            <span className="metric-label">Total Units</span>
          </div>
        </div>

        <div className="admin-metric-card glass">
          <div className="metric-icon-box metric-icon-amber">
            <BookOpen size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats.lessonsCount}</span>
            <span className="metric-label">Structured Lessons</span>
          </div>
        </div>

        <div className="admin-metric-card glass">
          <div className="metric-icon-box metric-icon-emerald">
            <FileText size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats.topicsCount}</span>
            <span className="metric-label">Syllabus Topics</span>
          </div>
        </div>

        <div className="admin-metric-card glass">
          <div className="metric-icon-box metric-icon-cyan">
            <FileCheck size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats.notesCount}</span>
            <span className="metric-label">Study Notes Attached</span>
          </div>
        </div>
      </div>

      {/* 2. Structured Filter & Control Card with Dropdowns */}
      <div className="smm-filter-card glass">
        {/* Dropdown Selectors Grid */}
        <div className="smm-selectors-grid">
          {/* Exam Dropdown */}
          <div className="smm-form-group">
            <div className="smm-group-header">
              <label htmlFor="smm-exam-select">
                <GraduationCap size={14} className="smm-field-icon text-gold" />
                <span>TNPSC Exam</span>
              </label>
            </div>
            <div className="smm-select-wrap">
              <select
                id="smm-exam-select"
                className="smm-select-dropdown"
                value={selectedExamId}
                onChange={(e) => {
                  const newExam = e.target.value;
                  setSelectedExamId(newExam);
                  setTree([]);
                  setLoading(true);
                }}
              >
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="smm-select-chevron" />
            </div>
          </div>

          {/* Subject Dropdown */}
          <div className="smm-form-group">
            <div className="smm-group-header">
              <label htmlFor="smm-subject-select">
                <BookOpen size={14} className="smm-field-icon text-amber" />
                <span>Subject / Domain</span>
              </label>
              <button
                type="button"
                className="smm-btn-mini-add"
                onClick={() =>
                  setSubjectModal({
                    open: true,
                    mode: 'add',
                    data: { subject_slug: '', name: '', description: '' },
                  })
                }
                title="Add a new Subject under active Exam"
              >
                <Plus size={12} />
                <span>New</span>
              </button>
            </div>
            <div className="smm-select-wrap">
              <select
                id="smm-subject-select"
                className="smm-select-dropdown"
                value={selectedSubjectSlug}
                onChange={(e) => setSelectedSubjectSlug(e.target.value)}
              >
                {subjects.map((sub) => (
                  <option key={sub.subject_slug} value={sub.subject_slug}>
                    {sub.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="smm-select-chevron" />
            </div>
          </div>

          {/* Standard Dropdown (Classes 6 to 12) */}
          <div className="smm-form-group">
            <div className="smm-group-header">
              <label htmlFor="smm-std-select">
                <Tag size={14} className="smm-field-icon text-cyan" />
                <span>Standard (Class)</span>
              </label>
              <span className="smm-group-badge">Classes 6–12</span>
            </div>
            <div className="smm-select-wrap">
              <select
                id="smm-std-select"
                className="smm-select-dropdown"
                value={selectedStandard === null ? 'all' : String(selectedStandard)}
                onChange={(e) =>
                  setSelectedStandard(e.target.value === 'all' ? null : parseInt(e.target.value, 10))
                }
              >
                <option value="all">All Standards (Classes 6th to 12th)</option>
                {[6, 7, 8, 9, 10, 11, 12].map((std) => (
                  <option key={std} value={std}>
                    {std}th Standard (Samacheer Kalvi)
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="smm-select-chevron" />
            </div>
          </div>
        </div>

        {/* Toolbar: Search & Global Actions */}
        <div className="smm-toolbar-row">
          <div className="smm-search-wrap">
            <Search size={15} className="smm-search-icon" />
            <input
              type="text"
              className="smm-search-input"
              placeholder="Search units, lessons, topics, standard..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="smm-search-clear"
                onClick={() => setSearchTerm('')}
                title="Clear Search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="smm-toolbar-actions">
            <div className="smm-toggle-buttons">
              <button type="button" className="smm-btn-ghost sm" onClick={expandAll} title="Expand all units and lessons">
                Expand All
              </button>
              <span className="smm-pipe-sep">|</span>
              <button type="button" className="smm-btn-ghost sm" onClick={collapseAll} title="Collapse all units and lessons">
                Collapse All
              </button>
            </div>

            <button
              type="button"
              className="smm-btn-ghost sm"
              onClick={fetchTree}
              disabled={refreshing}
              title="Refresh hierarchy from PostgreSQL"
            >
              <RefreshCw size={13} className={refreshing ? 'spin-icon' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              className="smm-btn-ai-import"
              onClick={handleOpenAiImport}
              title="Import official TNPSC syllabus from PDF or direct text with AI structuring"
            >
              <Sparkles size={15} />
              <span>AI Syllabus Import</span>
            </button>

            <button
              type="button"
              className="smm-btn-primary"
              onClick={handleOpenAddUnit}
              title="Add New Unit Dynamically (e.g., Unit 7, Unit 8)"
            >
              <FolderPlus size={15} />
              <span>Add Unit</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Main Hierarchy Tree View */}
      {loading ? (
        <div className="smm-state-card glass">
          <RefreshCw size={26} className="spin-icon text-gold" />
          <p className="smm-state-title">Loading Study Materials Hierarchy...</p>
          <span className="smm-state-sub">Fetching units, lessons, topics, and notes from PostgreSQL</span>
        </div>
      ) : filteredTree.length === 0 ? (
        <div className="smm-state-card glass">
          <BookOpen size={40} className="smm-empty-icon text-amber" />
          <p className="smm-state-title">No Study Materials Found</p>
          <p className="smm-state-sub">
            {searchTerm
              ? 'No units, lessons, or topics match your active search filter.'
              : `No units configured under ${selectedExamId.toUpperCase()} (${selectedSubjectSlug}).`}
          </p>
          <button type="button" className="smm-btn-primary mt-3" onClick={handleOpenAddUnit}>
            <FolderPlus size={15} />
            <span>Create First Unit</span>
          </button>
        </div>
      ) : (
        <div className="smm-units-stack">
          {filteredTree.map((unit, unitIdx) => {
            const isExpanded = expandedUnits.has(unit.id);
            const unitLessons = unit.lessons || [];

            return (
              <div key={unit.id} className={`smm-unit-card glass ${isExpanded ? 'is-expanded' : ''}`}>
                {/* UNIT ROW */}
                <div className="smm-unit-row" onClick={() => toggleUnit(unit.id)}>
                  <div className="smm-unit-meta">
                    <button
                      type="button"
                      className="smm-chevron-toggle"
                      aria-label="Toggle Unit"
                      tabIndex={-1}
                    >
                      <ChevronRight size={16} className={`smm-chevron-icon ${isExpanded ? 'rotated' : ''}`} />
                    </button>

                    <div className="smm-unit-badge-pill">
                      {unit.unit_code || `Unit ${unit.unit_number}`}
                    </div>

                    <div className="smm-unit-info">
                      <h3 className="smm-unit-title">{unit.title}</h3>
                      {unit.subject_name && (
                        <span className="smm-unit-subtitle">{unit.subject_name}</span>
                      )}
                    </div>
                  </div>

                  <div className="smm-unit-controls" onClick={(e) => e.stopPropagation()}>
                    <div className="smm-unit-stats-pills">
                      <span className="smm-stat-pill slate">{unitLessons.length} Lessons</span>
                      {unit.question_count ? (
                        <span className="smm-stat-pill gold">{unit.question_count} Qs</span>
                      ) : null}
                    </div>

                    <div className="smm-action-btn-group">
                      <button
                        type="button"
                        className="smm-action-btn btn-secondary"
                        onClick={() => handleMoveUnit(unitIdx, 'up')}
                        disabled={unitIdx === 0}
                        title="Move Unit Up"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="smm-action-btn btn-secondary"
                        onClick={() => handleMoveUnit(unitIdx, 'down')}
                        disabled={unitIdx === filteredTree.length - 1}
                        title="Move Unit Down"
                      >
                        <ChevronDown size={13} />
                      </button>
                      <button
                        type="button"
                        className="smm-action-btn btn-add"
                        onClick={() => handleOpenAddLesson(unit.id)}
                        title="Add Lesson to this unit"
                      >
                        <FilePlus size={13} />
                        <span>Add Lesson</span>
                      </button>
                      <button
                        type="button"
                        className="smm-action-btn btn-edit"
                        onClick={() =>
                          setUnitModal({
                            open: true,
                            mode: 'edit',
                            data: unit,
                          })
                        }
                        title="Edit Unit details"
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="smm-action-btn btn-delete"
                        onClick={() => openUnitDeleteConfirm(unit)}
                        title="Delete Unit"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* UNIT BODY: LESSONS & TOPICS */}
                {isExpanded && (
                  <div className="smm-unit-content">
                    {unitLessons.length === 0 ? (
                      <div className="smm-empty-lessons">
                        <span>No lessons added to this unit yet.</span>
                        <button
                          type="button"
                          className="smm-btn-inline-add"
                          onClick={() => handleOpenAddLesson(unit.id)}
                        >
                          <Plus size={13} /> Add First Lesson
                        </button>
                      </div>
                    ) : (
                      <div className="smm-lessons-stack">
                        {unitLessons.map((lesson, lessonIdx) => {
                          const isLessonExpanded = expandedLessons.has(lesson.id);
                          const topics = lesson.topics || [];

                          return (
                            <div
                              key={lesson.id}
                              className={`smm-lesson-card ${isLessonExpanded ? 'is-expanded' : ''}`}
                            >
                              {/* LESSON ROW */}
                              <div
                                className="smm-lesson-row"
                                onClick={() => toggleLesson(lesson.id)}
                              >
                                <div className="smm-lesson-meta">
                                  <button
                                    type="button"
                                    className="smm-lesson-chevron-toggle"
                                    aria-label="Toggle Lesson"
                                    tabIndex={-1}
                                  >
                                    <ChevronRight
                                      size={14}
                                      className={`smm-chevron-icon ${isLessonExpanded ? 'rotated' : ''}`}
                                    />
                                  </button>

                                  <div className="smm-lesson-tags">
                                    <span className="smm-pill-std">
                                      {lesson.standard_number}th Std
                                    </span>
                                    {lesson.term && (
                                      <span className="smm-pill-term">{lesson.term}</span>
                                    )}
                                    <span className="smm-pill-num">L-{lesson.lesson_number}</span>
                                  </div>

                                  <h4 className="smm-lesson-title" title={lesson.title}>
                                    {lesson.title}
                                  </h4>
                                </div>

                                <div
                                  className="smm-lesson-controls"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="smm-lesson-stats-pills">
                                    <span className="smm-stat-pill-sm slate">
                                      {topics.length} Topics
                                    </span>
                                    {lesson.has_notes ? (
                                      <span
                                        className="smm-stat-pill-sm note-ready"
                                        title="Study Notes attached to this lesson"
                                      >
                                        <FileCheck size={11} /> Note Ready
                                      </span>
                                    ) : (
                                      <span
                                        className="smm-stat-pill-sm note-pending"
                                        title="No Study Notes attached yet"
                                      >
                                        Pending Note
                                      </span>
                                    )}
                                  </div>

                                  <div className="smm-action-btn-group">
                                    <button
                                      type="button"
                                      className="smm-action-btn btn-secondary sm"
                                      onClick={() => handleMoveLesson(unitLessons, lessonIdx, 'up')}
                                      disabled={lessonIdx === 0}
                                      title="Move Lesson Up"
                                    >
                                      <ChevronUp size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="smm-action-btn btn-secondary sm"
                                      onClick={() => handleMoveLesson(unitLessons, lessonIdx, 'down')}
                                      disabled={lessonIdx === unitLessons.length - 1}
                                      title="Move Lesson Down"
                                    >
                                      <ChevronDown size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      className="smm-action-btn btn-add sm"
                                      onClick={() => handleOpenAddTopic(lesson.id, unit.id)}
                                      title="Add Topic to this lesson"
                                    >
                                      <Plus size={12} />
                                      <span>Add Topic</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="smm-action-btn btn-note sm"
                                      onClick={() => handleOpenNoteModal(lesson, lesson.title)}
                                      title="Upload or Edit Study Note for this Lesson"
                                    >
                                      <FileText size={12} />
                                      <span>{lesson.has_notes ? 'Edit Note' : 'Upload Note'}</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="smm-action-btn btn-edit sm"
                                      onClick={() =>
                                        setLessonModal({
                                          open: true,
                                          mode: 'edit',
                                          unitId: unit.id,
                                          data: lesson,
                                        })
                                      }
                                      title="Edit Lesson details"
                                    >
                                      <Edit2 size={12} />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="smm-action-btn btn-delete sm"
                                      onClick={() =>
                                        setDeleteConfirm({
                                          open: true,
                                          type: 'lesson',
                                          id: lesson.id,
                                          name: `Lesson ${lesson.lesson_number}: ${lesson.title}`,
                                        })
                                      }
                                      title="Delete Lesson"
                                    >
                                      <Trash2 size={12} />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* TOPICS CONTAINER */}
                              {isLessonExpanded && (
                                <div className="smm-topics-container">
                                  <div className="smm-topics-header">
                                    <span className="smm-topics-label">
                                      Curated Topics ({topics.length})
                                    </span>
                                  </div>

                                  {topics.length === 0 ? (
                                    <div className="smm-empty-topics">
                                      <span>No subtopics created for this lesson yet.</span>
                                      <button
                                        type="button"
                                        className="smm-btn-inline-add"
                                        onClick={() => handleOpenAddTopic(lesson.id, unit.id)}
                                      >
                                        <Plus size={12} /> Add First Topic
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="smm-topics-stack">
                                      {topics.map((topic, tIdx) => (
                                        <div key={topic.id || tIdx} className="smm-topic-row">
                                          <div className="smm-topic-meta">
                                            <span className="smm-topic-idx">{tIdx + 1}.</span>
                                            <span className="smm-topic-name" title={topic.topic_name}>
                                              {topic.topic_name}
                                            </span>
                                            {topic.has_notes ? (
                                              <span className="smm-topic-note-ready">
                                                <FileCheck size={11} /> Note Ready
                                              </span>
                                            ) : (
                                              <span className="smm-topic-note-pending">No Note</span>
                                            )}
                                          </div>

                                          <div className="smm-topic-actions">
                                            <button
                                              type="button"
                                              className="smm-action-btn btn-secondary xs"
                                              onClick={() => handleMoveTopic(topics, tIdx, 'up')}
                                              disabled={tIdx === 0}
                                              title="Move Topic Up"
                                            >
                                              <ChevronUp size={11} />
                                            </button>
                                            <button
                                              type="button"
                                              className="smm-action-btn btn-secondary xs"
                                              onClick={() => handleMoveTopic(topics, tIdx, 'down')}
                                              disabled={tIdx === topics.length - 1}
                                              title="Move Topic Down"
                                            >
                                              <ChevronDown size={11} />
                                            </button>
                                            <button
                                              type="button"
                                              className="smm-action-btn btn-note xs"
                                              onClick={() =>
                                                handleOpenNoteModal(lesson, topic.topic_name, topic.id)
                                              }
                                              title="Upload or edit note for this topic"
                                            >
                                              <FileText size={11} />
                                              <span>{topic.has_notes ? 'Edit Note' : 'Upload Note'}</span>
                                            </button>
                                            <button
                                              type="button"
                                              className="smm-action-btn btn-edit xs"
                                              onClick={() =>
                                                setTopicModal({
                                                  open: true,
                                                  mode: 'edit',
                                                  lessonId: lesson.id,
                                                  unitId: unit.id,
                                                  data: topic,
                                                })
                                              }
                                              title="Edit Topic"
                                            >
                                              <Edit2 size={11} />
                                              <span>Edit</span>
                                            </button>
                                            <button
                                              type="button"
                                              className="smm-action-btn btn-delete xs"
                                              onClick={() =>
                                                setDeleteConfirm({
                                                  open: true,
                                                  type: 'topic',
                                                  id: topic.id,
                                                  name: topic.topic_name,
                                                })
                                              }
                                              title="Delete Topic"
                                            >
                                              <Trash2 size={11} />
                                              <span>Delete</span>
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* =====================================================================
          MODALS
         ===================================================================== */}

      {/* 1. EXAM MODAL */}
      {examModal.open && (
        <div className="smm-modal-overlay">
          <div className="smm-modal-card">
            <div className="smm-modal-header">
              <div className="smm-modal-title-wrap">
                <GraduationCap size={18} className="text-gold" />
                <h3>{examModal.mode === 'add' ? 'Add New TNPSC Exam' : 'Edit Exam'}</h3>
              </div>
              <button
                type="button"
                className="smm-modal-close"
                onClick={() => setExamModal({ open: false, mode: 'add', data: {} })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="smm-modal-body">
              <label>Exam Identifier / Slug *</label>
              <input
                type="text"
                placeholder="e.g. group1, group2, group4"
                disabled={examModal.mode === 'edit'}
                value={examModal.data.id || ''}
                onChange={(e) => setExamModal({ ...examModal, data: { ...examModal.data, id: e.target.value } })}
              />

              <label>Exam Full Name *</label>
              <input
                type="text"
                placeholder="e.g. TNPSC Group 1 Preliminary"
                value={examModal.data.name || ''}
                onChange={(e) => setExamModal({ ...examModal, data: { ...examModal.data, name: e.target.value } })}
              />

              <label>Syllabus Code / Badge</label>
              <input
                type="text"
                placeholder="e.g. Code: 497 • Degree Standard"
                value={examModal.data.badge || ''}
                onChange={(e) => setExamModal({ ...examModal, data: { ...examModal.data, badge: e.target.value } })}
              />

              <label>Description / Posts Covered</label>
              <textarea
                rows={3}
                placeholder="Deputy Collector, DSP, Commercial Tax Officer..."
                value={examModal.data.description || ''}
                onChange={(e) =>
                  setExamModal({ ...examModal, data: { ...examModal.data, description: e.target.value } })
                }
              />
            </div>
            <div className="smm-modal-footer">
              <button
                type="button"
                className="smm-btn-ghost"
                onClick={() => setExamModal({ open: false, mode: 'add', data: {} })}
              >
                Cancel
              </button>
              <button type="button" className="smm-btn-primary" onClick={handleSaveExam}>
                Save Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SUBJECT MODAL */}
      {subjectModal.open && (
        <div className="smm-modal-overlay">
          <div className="smm-modal-card">
            <div className="smm-modal-header">
              <div className="smm-modal-title-wrap">
                <BookOpen size={18} className="text-amber" />
                <h3>{subjectModal.mode === 'add' ? 'Add Subject' : 'Edit Subject'}</h3>
              </div>
              <button
                type="button"
                className="smm-modal-close"
                onClick={() => setSubjectModal({ open: false, mode: 'add', data: {} })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="smm-modal-body">
              <label>Target Exam</label>
              <input type="text" disabled value={selectedExamId.toUpperCase()} />

              <label>Subject Slug (URL Key) *</label>
              <input
                type="text"
                placeholder="e.g. general-studies, aptitude, general-tamil"
                value={subjectModal.data.subject_slug || ''}
                onChange={(e) =>
                  setSubjectModal({ ...subjectModal, data: { ...subjectModal.data, subject_slug: e.target.value } })
                }
              />

              <label>Subject Name *</label>
              <input
                type="text"
                placeholder="e.g. General Studies (Degree Standard)"
                value={subjectModal.data.name || ''}
                onChange={(e) =>
                  setSubjectModal({ ...subjectModal, data: { ...subjectModal.data, name: e.target.value } })
                }
              />

              <label>Description / Curriculum Scope</label>
              <textarea
                rows={2}
                placeholder="Curriculum overview and paper pattern..."
                value={subjectModal.data.description || ''}
                onChange={(e) =>
                  setSubjectModal({ ...subjectModal, data: { ...subjectModal.data, description: e.target.value } })
                }
              />
            </div>
            <div className="smm-modal-footer">
              <button
                type="button"
                className="smm-btn-ghost"
                onClick={() => setSubjectModal({ open: false, mode: 'add', data: {} })}
              >
                Cancel
              </button>
              <button type="button" className="smm-btn-primary" onClick={handleSaveSubject}>
                Save Subject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. UNIT MODAL (DYNAMIC ADD UNIT) */}
      {unitModal.open && (
        <div className="smm-modal-overlay">
          <div className="smm-modal-card">
            <div className="smm-modal-header">
              <div className="smm-modal-title-wrap">
                <FolderPlus size={18} className="text-gold" />
                <h3>{unitModal.mode === 'add' ? 'Add New Unit Dynamically' : 'Edit Unit'}</h3>
              </div>
              <button
                type="button"
                className="smm-modal-close"
                onClick={() => setUnitModal({ open: false, mode: 'add', data: {} })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="smm-modal-body">
              <div className="smm-modal-grid-2">
                <div>
                  <label>Unit Number *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 7"
                    value={unitModal.data.unit_number ?? ''}
                    onChange={(e) => {
                      const num = parseInt(e.target.value, 10);
                      setUnitModal({
                        ...unitModal,
                        data: {
                          ...unitModal.data,
                          unit_number: isNaN(num) ? undefined : num,
                          unit_code: `Unit ${isNaN(num) ? '' : num}`,
                        },
                      });
                    }}
                  />
                </div>
                <div>
                  <label>Unit Code</label>
                  <input
                    type="text"
                    placeholder="e.g. Unit 7"
                    value={unitModal.data.unit_code || ''}
                    onChange={(e) =>
                      setUnitModal({ ...unitModal, data: { ...unitModal.data, unit_code: e.target.value } })
                    }
                  />
                </div>
              </div>

              <label>Unit Title *</label>
              <input
                type="text"
                placeholder="e.g. Development Administration in Tamil Nadu"
                value={unitModal.data.title || ''}
                onChange={(e) =>
                  setUnitModal({ ...unitModal, data: { ...unitModal.data, title: e.target.value } })
                }
              />

              <div className="smm-modal-grid-2">
                <div>
                  <label>Target Subject</label>
                  <input type="text" disabled value={selectedSubjectSlug} />
                </div>
                <div>
                  <label>Question Count</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 25"
                    value={unitModal.data.question_count ?? 20}
                    onChange={(e) =>
                      setUnitModal({
                        ...unitModal,
                        data: { ...unitModal.data, question_count: parseInt(e.target.value, 10) || 0 },
                      })
                    }
                  />
                </div>
              </div>

              <label>Syllabus Description / Scope</label>
              <textarea
                rows={3}
                placeholder="Key concepts, policy frameworks, and core textbook links..."
                value={unitModal.data.description || ''}
                onChange={(e) =>
                  setUnitModal({ ...unitModal, data: { ...unitModal.data, description: e.target.value } })
                }
              />
            </div>
            <div className="smm-modal-footer">
              <button
                type="button"
                className="smm-btn-ghost"
                onClick={() => setUnitModal({ open: false, mode: 'add', data: {} })}
              >
                Cancel
              </button>
              <button type="button" className="smm-btn-primary" onClick={handleSaveUnit}>
                {unitModal.mode === 'add' ? 'Create Unit' : 'Update Unit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. LESSON MODAL (TEXTBOOK-BASED AI GENERATION + MANUAL LESSON ENTRY) */}
      {lessonModal.open && (() => {
        const targetUnit = tree.find((u) => u.id === lessonModal.unitId);
        const isEditMode = lessonModal.mode === 'edit';
        const isAiMode = !isEditMode && lessonModalTab === 'ai_textbook';

        return (
          <div className="smm-modal-overlay">
            <div className={`smm-modal-card ${isAiMode ? 'ai-modal-large' : ''}`}>
              {/* MODAL HEADER */}
              <div className="smm-modal-header">
                <div className="smm-modal-title-wrap">
                  {isEditMode ? (
                    <>
                      <FilePlus size={18} className="text-emerald" />
                      <h3>Edit Lesson</h3>
                    </>
                  ) : isAiMode ? (
                    <>
                      <Sparkles size={18} className="text-cyan" />
                      <div>
                        <h3>Textbook-Based AI Lesson Generation</h3>
                        <span className="smm-modal-subtitle">
                          {targetUnit?.unit_code || `Unit ${targetUnit?.unit_number}`}: {targetUnit?.title}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <FilePlus size={18} className="text-emerald" />
                      <div>
                        <h3>Add Manual Lesson</h3>
                        <span className="smm-modal-subtitle">
                          {targetUnit?.unit_code || `Unit ${targetUnit?.unit_number}`}: {targetUnit?.title}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  className="smm-modal-close"
                  onClick={() => setLessonModal({ open: false, mode: 'add', unitId: 0, data: {} })}
                >
                  <X size={16} />
                </button>
              </div>

              {/* MODE SWITCHER TABS (Only in Add Mode) */}
              {!isEditMode && (
                <div className="smm-mode-switcher-tabs" style={{ margin: '0.85rem 1.6rem 0' }}>
                  <button
                    type="button"
                    className={`smm-mode-tab-btn ${lessonModalTab === 'ai_textbook' ? 'active' : ''}`}
                    onClick={() => setLessonModalTab('ai_textbook')}
                  >
                    <Sparkles size={15} />
                    <span>✨ AI Textbook Matcher (Recommended)</span>
                  </button>
                  <button
                    type="button"
                    className={`smm-mode-tab-btn manual ${lessonModalTab === 'manual' ? 'active manual' : ''}`}
                    onClick={() => setLessonModalTab('manual')}
                  >
                    <FilePlus size={15} />
                    <span>✍️ Manual Lesson Entry</span>
                  </button>
                </div>
              )}

              {/* MODAL BODY */}
              {isEditMode || lessonModalTab === 'manual' ? (
                // MANUAL LESSON FORM (PRESERVED 100%)
                <>
                  <div className="smm-modal-body">
                    <div className="smm-modal-grid-2">
                      <div>
                        <label>Standard (Class) *</label>
                        <select
                          className="smm-modal-select"
                          value={lessonModal.data.standard_number || 6}
                          onChange={(e) =>
                            setLessonModal({
                              ...lessonModal,
                              data: { ...lessonModal.data, standard_number: parseInt(e.target.value, 10) },
                            })
                          }
                        >
                          {[6, 7, 8, 9, 10, 11, 12].map((cls) => (
                            <option key={cls} value={cls}>
                              {cls}th Standard
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label>Term / Book Volume</label>
                        <select
                          className="smm-modal-select"
                          value={lessonModal.data.term || 'Term 1'}
                          onChange={(e) =>
                            setLessonModal({ ...lessonModal, data: { ...lessonModal.data, term: e.target.value } })
                          }
                        >
                          <option value="Term 1">Term 1</option>
                          <option value="Term 2">Term 2</option>
                          <option value="Term 3">Term 3</option>
                          <option value="Full Book">Full Book / Annual</option>
                          <option value="Volume 1">Volume 1</option>
                          <option value="Volume 2">Volume 2</option>
                        </select>
                      </div>
                    </div>

                    <div className="smm-modal-grid-2">
                      <div>
                        <label>Lesson Number *</label>
                        <input
                          type="text"
                          placeholder="e.g. 1, 2, 7.1"
                          value={lessonModal.data.lesson_number || ''}
                          onChange={(e) =>
                            setLessonModal({
                              ...lessonModal,
                              data: { ...lessonModal.data, lesson_number: e.target.value },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label>Lesson Status</label>
                        <select
                          className="smm-modal-select"
                          value={lessonModal.data.status || 'Available'}
                          onChange={(e) =>
                            setLessonModal({ ...lessonModal, data: { ...lessonModal.data, status: e.target.value } })
                          }
                        >
                          <option value="Available">Available</option>
                          <option value="Coming Soon">Coming Soon</option>
                        </select>
                      </div>
                    </div>

                    <label>Lesson Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Human Development Indicators in Tamil Nadu"
                      value={lessonModal.data.title || ''}
                      onChange={(e) =>
                        setLessonModal({ ...lessonModal, data: { ...lessonModal.data, title: e.target.value } })
                      }
                    />

                    <label>Description / Learning Goals</label>
                    <textarea
                      rows={2}
                      placeholder="Summary of topics, textbook chapters, and exam takeaways..."
                      value={lessonModal.data.description || ''}
                      onChange={(e) =>
                        setLessonModal({ ...lessonModal, data: { ...lessonModal.data, description: e.target.value } })
                      }
                    />
                  </div>
                  <div className="smm-modal-footer">
                    <button
                      type="button"
                      className="smm-btn-ghost"
                      onClick={() => setLessonModal({ open: false, mode: 'add', unitId: 0, data: {} })}
                    >
                      Cancel
                    </button>
                    <button type="button" className="smm-btn-primary" onClick={handleSaveLesson}>
                      {isEditMode ? 'Update Lesson' : 'Create Lesson'}
                    </button>
                  </div>
                </>
              ) : (
                // TEXTBOOK-BASED AI LESSON FILTERING & GENERATION
                <>
                  <div className="smm-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {/* TARGET UNIT SUMMARY BANNER */}
                    <div className="smm-unit-target-banner">
                      <div className="smm-unit-target-left">
                        <span className="smm-unit-target-pill">
                          {targetUnit?.unit_code || `Unit ${targetUnit?.unit_number || 1}`}
                        </span>
                        <span className="smm-unit-target-title">{targetUnit?.title}</span>
                      </div>
                      <span className="smm-unit-target-count">
                        {targetUnit?.lessons?.length || 0} Current Lessons
                      </span>
                    </div>

                    {/* STEP A: SELECTION & CONFIGURATION */}
                    {aiMatchingStep === 'select' && (
                      <>
                        {/* 1. TNPSC TOPIC INPUT */}
                        <div className="smm-tb-section-title">
                          <span className="step-badge">1</span>
                          <span>TNPSC Syllabus Topics for this Unit</span>
                        </div>
                        <p style={{ margin: '0 0 0.4rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                          Enter or paste the TNPSC syllabus topics. The AI will strictly filter chapters from the selected textbook that correspond to these topics.
                        </p>
                        <textarea
                          className="smm-topics-textarea"
                          rows={3}
                          value={tbTopicsInput}
                          onChange={(e) => setTbTopicsInput(e.target.value)}
                          placeholder="e.g. Fundamental Rights, Directive Principles of State Policy, Union Executive, Parliament, Judiciary in India..."
                        />

                        {/* 2. TEXTBOOK FILTER CONTROLS */}
                        <div className="smm-tb-section-title">
                          <span className="step-badge">2</span>
                          <span>Filter & Select Samacheer Kalvi Textbook (Google Drive)</span>
                        </div>

                        <div className="smm-tb-filter-grid">
                          <div className="smm-tb-filter-field">
                            <label>Standard (Class)</label>
                            <select
                              className="smm-modal-select"
                              value={tbStandard}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setTbStandard(val);
                                fetchAvailableTextbooks(val, tbSubject, tbTerm, tbSearch);
                              }}
                            >
                              <option value={0}>All Classes (6th-12th)</option>
                              {[6, 7, 8, 9, 10, 11, 12].map((cls) => (
                                <option key={cls} value={cls}>
                                  {cls}th Standard
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="smm-tb-filter-field">
                            <label>Textbook Subject</label>
                            <select
                              className="smm-modal-select"
                              value={tbSubject}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTbSubject(val);
                                fetchAvailableTextbooks(tbStandard, val, tbTerm, tbSearch);
                              }}
                            >
                              <option value="all">All Subjects</option>
                              <option value="Science">Science</option>
                              <option value="Social Science">Social Science</option>
                              <option value="History">History</option>
                              <option value="Geography">Geography</option>
                              <option value="Civics">Civics / Polity</option>
                              <option value="Economics">Economics</option>
                              <option value="Tamil">Tamil</option>
                              <option value="English">English</option>
                              <option value="Mathematics">Mathematics</option>
                            </select>
                          </div>

                          <div className="smm-tb-filter-field">
                            <label>Term / Volume</label>
                            <select
                              className="smm-modal-select"
                              value={tbTerm}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTbTerm(val);
                                fetchAvailableTextbooks(tbStandard, tbSubject, val, tbSearch);
                              }}
                            >
                              <option value="all">All Terms</option>
                              <option value="Term 1">Term 1</option>
                              <option value="Term 2">Term 2</option>
                              <option value="Term 3">Term 3</option>
                              <option value="Full">Full Book / Annual</option>
                            </select>
                          </div>
                        </div>

                        {/* TEXTBOOK SEARCH & BULK SELECT */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '0.6rem',
                            gap: '0.75rem',
                          }}
                        >
                          <div style={{ flex: 1, position: 'relative' }}>
                            <input
                              type="text"
                              placeholder="Search textbook filename..."
                              value={tbSearch}
                              onChange={(e) => {
                                setTbSearch(e.target.value);
                                fetchAvailableTextbooks(tbStandard, tbSubject, tbTerm, e.target.value);
                              }}
                              style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="smm-btn-ghost"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                if (selectedTextbookIds.length === availableTextbooks.length) {
                                  setSelectedTextbookIds([]);
                                } else {
                                  setSelectedTextbookIds(availableTextbooks.map((t) => t.id));
                                }
                              }}
                            >
                              {selectedTextbookIds.length === availableTextbooks.length && availableTextbooks.length > 0
                                ? 'Deselect All'
                                : 'Select All'}
                            </button>
                            <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>
                              {selectedTextbookIds.length} of {availableTextbooks.length} selected
                            </span>
                          </div>
                        </div>

                        {/* TEXTBOOK LIST */}
                        <div className="smm-tb-list-container">
                          {isLoadingTextbooks ? (
                            <div className="smm-tb-empty">
                              <Loader2 size={24} className="spin text-cyan" />
                              <span>Loading Google Drive textbook files...</span>
                            </div>
                          ) : availableTextbooks.length === 0 ? (
                            <div className="smm-tb-empty">
                              <BookOpen size={28} className="text-muted" />
                              <span>No Google Drive textbook PDFs found matching current filters.</span>
                              <button
                                type="button"
                                className="smm-btn-ghost"
                                style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setTbStandard(0);
                                  setTbSubject('all');
                                  setTbTerm('all');
                                  setTbSearch('');
                                  fetchAvailableTextbooks(0, 'all', 'all');
                                }}
                              >
                                View All Uploaded Textbooks
                              </button>
                            </div>
                          ) : (
                            availableTextbooks.map((tb) => {
                              const isChecked = selectedTextbookIds.includes(tb.id);
                              return (
                                <div
                                  key={tb.id}
                                  className={`smm-tb-item-card ${isChecked ? 'is-selected' : ''}`}
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedTextbookIds((prev) => prev.filter((id) => id !== tb.id));
                                    } else {
                                      setSelectedTextbookIds((prev) => [...prev, tb.id]);
                                    }
                                  }}
                                >
                                  <div className="smm-tb-item-left">
                                    <div className="smm-tb-check">
                                      {isChecked ? <CheckSquare size={17} /> : <Square size={17} />}
                                    </div>
                                    <BookOpen size={16} className="text-cyan" style={{ flexShrink: 0 }} />
                                    <div className="smm-tb-details">
                                      <div className="smm-tb-name" title={tb.fileName}>
                                        {tb.fileName}
                                      </div>
                                      <div className="smm-tb-badges">
                                        <span className="smm-badge-std">Class {tb.standard}</span>
                                        <span className="smm-badge-subject">{tb.subject}</span>
                                        <span className="smm-badge-term">{tb.term}</span>
                                        <span className="smm-badge-meta">{tb.fileSizeFormatted}</span>
                                        {tb.totalPages > 0 && (
                                          <span className="smm-badge-meta">• {tb.totalPages} pages</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}

                    {/* STEP B: LOADING & MATCHING ANIMATION */}
                    {aiMatchingStep === 'matching' && (
                      <div className="smm-loading-state">
                        <div className="smm-loading-spinner-glow" />
                        <div className="smm-loading-title">AI Textbook Matching in Progress</div>
                        <div className="smm-loading-sub">{matchingStatusMessage}</div>
                        <p style={{ fontSize: '0.78rem', color: '#64748b', maxWidth: '420px', margin: 0 }}>
                          Parsing textbook Table of Contents and chapter titles from Google Drive, then comparing each chapter with TNPSC Unit syllabus topics...
                        </p>
                        <button
                          type="button"
                          className="smm-btn-ghost sm"
                          style={{
                            marginTop: '0.85rem',
                            borderColor: 'rgba(239, 68, 68, 0.45)',
                            color: '#f87171',
                            padding: '0.35rem 0.85rem',
                            fontSize: '0.78rem',
                          }}
                          onClick={() => {
                            if (aiMatchingAbortRef.current) aiMatchingAbortRef.current.abort();
                            setAiMatchingStep('select');
                          }}
                        >
                          Cancel Matching
                        </button>
                      </div>
                    )}

                    {/* STEP C: REVIEW & APPROVAL LIST */}
                    {aiMatchingStep === 'review' && (
                      <>
                        <div className="smm-review-banner">
                          <div className="smm-review-meta">
                            <CheckCircle2 size={18} className="text-emerald" />
                            <span className="smm-review-count">
                              Found {matchedLessons.length} matching lessons
                            </span>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                              ({matchedLessons.filter((m) => m.selected).length} selected to save)
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="smm-btn-ghost"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                const allSelected = matchedLessons.every((m) => m.selected);
                                setMatchedLessons((prev) =>
                                  prev.map((m) => ({ ...m, selected: !allSelected }))
                                );
                              }}
                            >
                              {matchedLessons.every((m) => m.selected) ? 'Deselect All' : 'Select All'}
                            </button>
                            <button
                              type="button"
                              className="smm-btn-ghost"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => setAiMatchingStep('select')}
                            >
                              ← Adjust Textbooks
                            </button>
                          </div>
                        </div>

                        {matchedLessons.length === 0 ? (
                          <div className="smm-tb-empty">
                            <AlertCircle size={28} className="text-amber" />
                            <span>No lessons in the selected textbook matched your TNPSC topics.</span>
                            <button
                              type="button"
                              className="smm-btn-ghost"
                              style={{ marginTop: '0.5rem' }}
                              onClick={() => setAiMatchingStep('select')}
                            >
                              ← Back to Adjust Criteria
                            </button>
                          </div>
                        ) : (
                          <div className="smm-matched-lesson-list">
                            {matchedLessons.map((item, idx) => {
                              return (
                                <div
                                  key={item.id || idx}
                                  className={`smm-matched-card ${item.selected ? 'is-selected' : ''}`}
                                >
                                  <div className="smm-matched-header">
                                    <div className="smm-matched-left">
                                      <div
                                        className="smm-tb-check"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() =>
                                          setMatchedLessons((prev) => {
                                            const next = [...prev];
                                            next[idx] = { ...next[idx], selected: !next[idx].selected };
                                            return next;
                                          })
                                        }
                                      >
                                        {item.selected ? <CheckSquare size={18} /> : <Square size={18} />}
                                      </div>

                                      <span className="smm-badge-std" style={{ flexShrink: 0 }}>
                                        Std {item.standard_number}
                                      </span>
                                      <span className="smm-badge-subject" style={{ flexShrink: 0 }}>
                                        {item.subject}
                                      </span>
                                      <span className="smm-badge-term" style={{ flexShrink: 0 }}>
                                        {item.term}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          color: '#94a3b8',
                                          flexShrink: 0,
                                        }}
                                      >
                                        Ch {item.lesson_number}
                                      </span>

                                      <input
                                        type="text"
                                        className="smm-matched-title-input"
                                        value={item.lesson_title}
                                        title="Click to edit lesson title before saving"
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setMatchedLessons((prev) => {
                                            const next = [...prev];
                                            next[idx] = { ...next[idx], lesson_title: val };
                                            return next;
                                          });
                                        }}
                                      />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                      {item.is_already_in_db && (
                                        <span className="smm-duplicate-pill" title="This lesson is already in this unit">
                                          Already in Unit
                                        </span>
                                      )}
                                      <span className="smm-reason-pill">
                                        <Sparkles size={11} />
                                        {item.confidence_score}% Match
                                      </span>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      paddingLeft: '2rem',
                                      fontSize: '0.78rem',
                                      color: '#94a3b8',
                                    }}
                                  >
                                    <span>
                                      <strong>Relevance:</strong> {item.matching_reason}
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                      Source: {item.textbook_file_name}
                                    </span>
                                  </div>

                                  {item.topics && item.topics.length > 0 && (
                                    <div className="smm-matched-subtopics">
                                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Topics:</span>
                                      {item.topics.map((t, tIdx) => (
                                        <span key={tIdx} className="smm-subtopic-tag">
                                          {t.topic_name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* MODAL FOOTER */}
                  <div className="smm-modal-footer">
                    <button
                      type="button"
                      className="smm-btn-ghost"
                      onClick={() => setLessonModal({ open: false, mode: 'add', unitId: 0, data: {} })}
                    >
                      Cancel
                    </button>

                    {aiMatchingStep === 'select' && (
                      <button
                        type="button"
                        className="smm-btn-primary"
                        disabled={selectedTextbookIds.length === 0 || !tbTopicsInput.trim()}
                        onClick={handleRunAiLessonMatching}
                      >
                        <Sparkles size={14} />
                        <span>⚡ Analyze Textbook & Filter Relevant Lessons</span>
                      </button>
                    )}

                    {aiMatchingStep === 'review' && (
                      <button
                        type="button"
                        className="smm-btn-primary"
                        style={{
                          background: 'linear-gradient(135deg, #059669, #10b981)',
                          borderColor: '#10b981',
                        }}
                        disabled={
                          isSavingMatchedLessons || matchedLessons.filter((m) => m.selected).length === 0
                        }
                        onClick={handleSaveApprovedMatchedLessons}
                      >
                        {isSavingMatchedLessons ? (
                          <>
                            <Loader2 size={14} className="spin" />
                            <span>Saving Lessons to Database...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={14} />
                            <span>
                              Save {matchedLessons.filter((m) => m.selected).length} Approved Lessons to Unit
                            </span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* 5. TOPIC MODAL */}
      {topicModal.open && (
        <div className="smm-modal-overlay">
          <div className="smm-modal-card">
            <div className="smm-modal-header">
              <div className="smm-modal-title-wrap">
                <FileText size={18} className="text-cyan" />
                <h3>{topicModal.mode === 'add' ? 'Add Topic to Lesson' : 'Edit Topic'}</h3>
              </div>
              <button
                type="button"
                className="smm-modal-close"
                onClick={() => setTopicModal({ open: false, mode: 'add', lessonId: '', unitId: 0, data: {} })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="smm-modal-body">
              <label>Topic Name *</label>
              <input
                type="text"
                placeholder="e.g. Human Development Index (HDI) Rankings"
                value={topicModal.data.topic_name || ''}
                onChange={(e) =>
                  setTopicModal({ ...topicModal, data: { ...topicModal.data, topic_name: e.target.value } })
                }
              />

              <label>Topic Notes / Key Points</label>
              <textarea
                rows={3}
                placeholder="Key formulas, historical facts, dates, rankings..."
                value={topicModal.data.description || ''}
                onChange={(e) =>
                  setTopicModal({ ...topicModal, data: { ...topicModal.data, description: e.target.value } })
                }
              />
            </div>
            <div className="smm-modal-footer">
              <button
                type="button"
                className="smm-btn-ghost"
                onClick={() => setTopicModal({ open: false, mode: 'add', lessonId: '', unitId: 0, data: {} })}
              >
                Cancel
              </button>
              <button type="button" className="smm-btn-primary" onClick={handleSaveTopic}>
                {topicModal.mode === 'add' ? 'Create Topic' : 'Update Topic'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. STUDY NOTE UPLOAD & ATTACH MODAL */}
      {noteModal.open && (
        <div className="smm-modal-overlay">
          <div className="smm-modal-card note-modal-card">
            <div className="smm-modal-header">
              <div className="smm-modal-title-wrap">
                <FileCheck size={18} className="text-gold" />
                <div>
                  <h3>Upload & Publish Study Notes</h3>
                  <span className="smm-modal-subtitle">
                    {noteModal.standardNumber}th Std • {noteModal.lessonTitle} • {noteModal.topicName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="smm-modal-close"
                onClick={() => setNoteModal((prev) => ({ ...prev, open: false }))}
              >
                <X size={16} />
              </button>
            </div>

            <div className="smm-modal-body">
              <div className="smm-note-tab-strip">
                <button
                  type="button"
                  className={`smm-note-tab ${!noteModal.preview ? 'active' : ''}`}
                  onClick={() => setNoteModal((prev) => ({ ...prev, preview: false }))}
                >
                  <Edit2 size={13} />
                  <span>Editor (Markdown / HTML)</span>
                </button>
                <button
                  type="button"
                  className={`smm-note-tab ${noteModal.preview ? 'active' : ''}`}
                  onClick={() => setNoteModal((prev) => ({ ...prev, preview: true }))}
                >
                  <Eye size={13} />
                  <span>Student View Preview</span>
                </button>
              </div>

              {!noteModal.preview ? (
                <div className="smm-note-editor-wrap">
                  <label>Study Note Content *</label>
                  <textarea
                    rows={12}
                    className="smm-note-textarea"
                    placeholder="Enter comprehensive study notes, key exam points, formulas, summaries, tables, or Samacheer Kalvi box items..."
                    value={noteModal.content}
                    onChange={(e) => setNoteModal({ ...noteModal, content: e.target.value })}
                  />
                  <span className="smm-editor-hint">
                    Supports Markdown formatting (## Headings, - Bullet lists, **Bold**, tables, etc.).
                  </span>
                </div>
              ) : (
                <div className="smm-note-preview glass">
                  <h4>{noteModal.topicName}</h4>
                  <div
                    className="smm-rendered-content"
                    dangerouslySetInnerHTML={{
                      __html: noteModal.content
                        ? noteModal.content.replace(/\n/g, '<br />')
                        : '<em>No content entered yet.</em>',
                    }}
                  />
                </div>
              )}
            </div>

            <div className="smm-modal-footer">
              <button
                type="button"
                className="smm-btn-ghost"
                onClick={() => setNoteModal((prev) => ({ ...prev, open: false }))}
              >
                Cancel
              </button>
              <button
                type="button"
                className="smm-btn-primary highlight"
                onClick={handleSaveNote}
                disabled={noteModal.submitting}
              >
                {noteModal.submitting ? (
                  <>
                    <RefreshCw size={14} className="spin-icon" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <FileCheck size={14} />
                    <span>Save & Publish Note</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. DELETE CONFIRMATION MODAL */}
      {deleteConfirm.open && (
        <div className="smm-modal-overlay">
          <div className="smm-modal-card delete-card">
            <div className="smm-modal-header danger-header">
              <div className="smm-modal-title-wrap danger">
                <AlertCircle size={20} />
                <h3>Confirm Deletion</h3>
              </div>
              <button
                type="button"
                className="smm-modal-close"
                onClick={() => setDeleteConfirm({ open: false, type: 'unit', id: null, name: '' })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="smm-modal-body">
              <p className="smm-delete-lead">
                Are you sure you want to permanently delete this {deleteConfirm.type}:
              </p>
              <div className="smm-delete-target-pill">{deleteConfirm.name}</div>
              {deleteConfirm.type === 'unit' && deleteConfirm.loadingDeps ? (
                <p className="smm-delete-warning">
                  <Loader2 size={14} className="spin-icon" /> Checking lessons, topics and study notes in this unit...
                </p>
              ) : deleteConfirm.type === 'unit' && deleteConfirm.dependencies ? (
                deleteConfirm.dependencies.lessons + deleteConfirm.dependencies.topics + deleteConfirm.dependencies.notes > 0 ? (
                  <p className="smm-delete-warning">
                    ⚠️ This unit contains <strong>{deleteConfirm.dependencies.lessons}</strong> lesson(s),{' '}
                    <strong>{deleteConfirm.dependencies.topics}</strong> topic(s) and{' '}
                    <strong>{deleteConfirm.dependencies.notes}</strong> study note(s). They will all be permanently
                    deleted from the database.
                    {deleteConfirm.dependencies.questions > 0 &&
                      ` ${deleteConfirm.dependencies.questions} linked practice question(s) in the Question Bank will be kept.`}
                  </p>
                ) : (
                  <p className="smm-delete-warning">This unit has no lessons, topics or study notes.</p>
                )
              ) : (
                <p className="smm-delete-warning">
                  ⚠️ All nested child items (lessons, topics, and attached study notes) will be deleted
                  permanently from the database.
                </p>
              )}
            </div>
            <div className="smm-modal-footer">
              <button
                type="button"
                className="smm-btn-ghost"
                onClick={closeDeleteConfirm}
                disabled={deleteConfirm.submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="smm-btn-danger"
                onClick={handleExecuteDelete}
                disabled={deleteConfirm.submitting || deleteConfirm.loadingDeps}
              >
                {deleteConfirm.submitting ? <Loader2 size={14} className="spin-icon" /> : <Trash2 size={14} />}
                <span>{deleteConfirm.submitting ? 'Deleting...' : 'Yes, Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 8. AI SYLLABUS PDF IMPORT MODAL */}
      {aiImportModalOpen && (
        <div className="smm-modal-overlay">
          <div className="smm-modal-card ai-modal-large">
            {/* Modal Header */}
            <div className="smm-modal-header">
              <div className="smm-modal-title-wrap">
                <Sparkles size={20} className="text-purple" />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h3 style={{ margin: 0 }}>AI Syllabus Import</h3>
                    <span className="smm-ai-header-badge">PDF & Text Auto-Extraction</span>
                  </div>
                  <span className="smm-modal-subtitle">
                    Import official TNPSC Syllabus (Group 1, 2, 2A, 4) via PDF upload or direct text paste to auto-extract units, lessons, and topics
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="smm-modal-close"
                onClick={() => setAiImportModalOpen(false)}
                disabled={isPublishing || aiImportStep === 'analyzing'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: Switch between 'upload', 'analyzing', 'review' */}
            <div className="smm-modal-body" style={{ overflowY: 'auto' }}>
              {/* STEP 1: UPLOAD & INPUT SCREEN */}
              {aiImportStep === 'upload' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {aiImportError && (
                    <div
                      className="smm-ai-warning-box"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                    >
                      <div className="smm-ai-warning-header" style={{ color: '#f87171' }}>
                        <AlertTriangle size={16} />
                        <span>Analysis Error</span>
                      </div>
                      <div className="smm-ai-warning-sub">{aiImportError}</div>
                    </div>
                  )}

                  <div className="smm-modal-grid-2">
                    <div>
                      <label>Target TNPSC Examination *</label>
                      <select
                        className="smm-modal-select"
                        value={aiImportExamId}
                        onChange={(e) => setAiImportExamId(e.target.value)}
                      >
                        <option value="group1">TNPSC Group 1</option>
                        <option value="group2">TNPSC Group 2, 2A</option>
                        <option value="group4">TNPSC Group 4</option>
                      </select>
                    </div>

                    <div>
                      <label>Target Subject / Paper *</label>
                      <select
                        className="smm-modal-select"
                        value={aiImportSubjectSlug}
                        onChange={(e) => setAiImportSubjectSlug(e.target.value)}
                      >
                        <option value="all">🌟 Complete Syllabus – All Units & Sections (Auto-Detect)</option>
                        <option value="general-studies">General Studies (பொது அறிவு)</option>
                        <option value="aptitude">Aptitude and Mental Ability (திறனறிவு)</option>
                        <option value="general-tamil">General Tamil (பொதுத் தமிழ்)</option>
                        <option value="general-english">General English</option>
                      </select>
                    </div>
                  </div>

                  {/* Mode Selector Tabs: PDF vs Text Paste */}
                  <div className="smm-ai-tab-group">
                    <button
                      type="button"
                      className={`smm-ai-tab-btn ${aiImportInputMode === 'pdf' ? 'active' : ''}`}
                      onClick={() => {
                        setAiImportInputMode('pdf');
                        setAiImportError(null);
                      }}
                    >
                      <FileText size={15} />
                      <span>Upload Syllabus PDF</span>
                    </button>
                    <button
                      type="button"
                      className={`smm-ai-tab-btn ${aiImportInputMode === 'text' ? 'active' : ''}`}
                      onClick={() => {
                        setAiImportInputMode('text');
                        setAiImportError(null);
                      }}
                    >
                      <Edit2 size={15} />
                      <span>Direct Text Paste</span>
                    </button>
                  </div>

                  {aiImportInputMode === 'pdf' ? (
                    /* Drag & Drop File Upload Area */
                    <div>
                      <label>Official TNPSC Syllabus PDF File *</label>
                      <label
                        htmlFor="smm-syllabus-file-input"
                        className="smm-ai-upload-box"
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            const f = e.dataTransfer.files[0];
                            if (f.type === 'application/pdf' || f.name.endsWith('.pdf')) {
                              setAiImportFile(f);
                              setAiImportError(null);
                            } else {
                              setAiImportError('Please provide a valid PDF file.');
                            }
                          }
                        }}
                      >
                        <UploadCloud size={38} className="smm-ai-upload-icon" />
                        <div className="smm-ai-upload-title">
                          {aiImportFile ? aiImportFile.name : 'Click to Browse or Drag & Drop Syllabus PDF'}
                        </div>
                        <div className="smm-ai-upload-sub">
                          {aiImportFile
                            ? `${(aiImportFile.size / (1024 * 1024)).toFixed(2)} MB PDF selected`
                            : 'Supports official TNPSC notification & syllabus PDF files (up to 50MB)'}
                        </div>
                        <input
                          id="smm-syllabus-file-input"
                          type="file"
                          accept="application/pdf"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setAiImportFile(e.target.files[0]);
                              setAiImportError(null);
                            }
                          }}
                        />
                      </label>

                      {aiImportFile && (
                        <div className="smm-ai-file-preview">
                          <FileCheck size={18} className="text-emerald" />
                          <span style={{ flex: 1, fontWeight: 600 }}>{aiImportFile.name}</span>
                          <button
                            type="button"
                            className="smm-search-clear"
                            onClick={() => setAiImportFile(null)}
                            title="Remove file"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Direct Text Paste Area */
                    <div className="smm-ai-textarea-box">
                      <div className="smm-ai-textarea-toolbar">
                        <label style={{ margin: 0, fontWeight: 600, color: '#f1f5f9' }}>
                          Paste TNPSC Syllabus Text *
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="smm-btn-ghost sm"
                            onClick={() => setAiImportPastedText(SAMPLE_TNPSC_SYLLABUS)}
                            title="Insert sample TNPSC syllabus to preview"
                          >
                            <Sparkles size={12} className="text-amber" />
                            <span>Insert Sample TNPSC Format</span>
                          </button>
                          {aiImportPastedText && (
                            <button
                              type="button"
                              className="smm-btn-ghost sm"
                              onClick={() => setAiImportPastedText('')}
                              title="Clear text"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        className="smm-ai-textarea"
                        rows={10}
                        placeholder={`Paste syllabus text here...\n\nExample:\nUNIT-I: GENERAL SCIENCE\n(i) Scientific Knowledge and Scientific Temper - Power of Reasoning - Rote Learning vs Conceptual Learning...\n(ii) Nature of Universe - General Scientific Laws – Mechanics - Properties of Matter, Force, Motion and Energy...\n(iii) Elements and Compounds, Acids, Bases, Salts, Petroleum Products, Fertilizers, Pesticides.`}
                        value={aiImportPastedText}
                        onChange={(e) => {
                          setAiImportPastedText(e.target.value);
                          setAiImportError(null);
                        }}
                      />
                      <div className="smm-ai-char-counter">
                        <span>{aiImportPastedText.length} characters</span>
                        {aiImportPastedText.trim().length >= 30 ? (
                          <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <CheckCircle2 size={12} /> Ready for analysis
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Minimum 30 characters required</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: ANALYZING SPINNER */}
              {aiImportStep === 'analyzing' && (
                <div className="smm-ai-analyzing-wrap">
                  <div className="smm-ai-spinner" />
                  <div>
                    <h4 style={{ margin: '0 0 0.4rem', color: '#f8fafc', fontSize: '1.1rem' }}>
                      Analyzing & Structuring Syllabus...
                    </h4>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.86rem' }}>
                      Extracting text, detecting units, identifying standard references, and organizing topics...
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 3: ADMIN REVIEW BEFORE PUBLISHING */}
              {aiImportStep === 'review' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Summary Bar */}
                  <div className="smm-ai-summary-bar">
                    <div className="smm-ai-stat-chip">
                      <span className="smm-ai-stat-label">Exam</span>
                      <span className="smm-ai-stat-value" style={{ color: '#ffd700' }}>
                        {aiAnalysisResult?.exam_name || aiImportExamId.toUpperCase()}
                      </span>
                    </div>
                    <div className="smm-ai-stat-chip">
                      <span className="smm-ai-stat-label">Subject</span>
                      <span className="smm-ai-stat-value" style={{ color: '#38bdf8' }}>
                        {aiAnalysisResult?.subject_name || 'General Studies'}
                      </span>
                    </div>
                    <div className="smm-ai-stat-chip">
                      <span className="smm-ai-stat-label">Total Units</span>
                      <span className="smm-ai-stat-value" style={{ color: '#c084fc' }}>
                        {editableUnits.length}
                      </span>
                    </div>
                    <div className="smm-ai-stat-chip">
                      <span className="smm-ai-stat-label">Total Lessons</span>
                      <span className="smm-ai-stat-value">
                        {editableUnits.reduce((acc, u) => acc + u.lessons.length, 0)}
                      </span>
                    </div>
                    <div className="smm-ai-stat-chip">
                      <span className="smm-ai-stat-label">Total Topics</span>
                      <span className="smm-ai-stat-value">
                        {editableUnits.reduce(
                          (acc, u) => acc + u.lessons.reduce((lAcc, l) => lAcc + l.topics.length, 0),
                          0
                        )}
                      </span>
                    </div>
                    <div className="smm-ai-stat-chip">
                      <span className="smm-ai-stat-label">Engine</span>
                      <span className="smm-ai-stat-value" style={{ fontSize: '0.82rem', color: '#10b981' }}>
                        {aiAnalysisResult?.parsing_mode === 'ai_cloud' ? 'AI Cloud' : 'Structural Parser'}
                      </span>
                    </div>
                  </div>

                  {/* Overwrite Protection Banner if duplicates detected */}
                  {aiAnalysisResult?.existing_comparison?.duplicate_units &&
                    aiAnalysisResult.existing_comparison.duplicate_units.length > 0 && (
                      <div className="smm-ai-warning-box">
                        <div className="smm-ai-warning-header">
                          <AlertTriangle size={16} />
                          <span>Existing Syllabus Units Detected in {aiImportExamId.toUpperCase()}</span>
                        </div>
                        <div className="smm-ai-warning-sub">
                          The database already has {aiAnalysisResult.existing_comparison.duplicate_units.length} units
                          for this exam ({aiAnalysisResult.existing_comparison.duplicate_units.join(', ')}).
                        </div>
                        <label className="smm-ai-overwrite-toggle">
                          <input
                            type="checkbox"
                            checked={overwriteExisting}
                            onChange={(e) => setOverwriteExisting(e.target.checked)}
                          />
                          <span>
                            <strong>Overwrite / Update existing units</strong> with extracted syllabus (uncheck to
                            append as additional units)
                          </span>
                        </label>
                      </div>
                    )}

                  {/* Editable Units & Topics Tree with Bulk & Individual Selection */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.6rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      padding: '0.55rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: '#f1f5f9',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            editableUnits.length > 0 &&
                            editableUnits.every((u) => u.selected_for_publish !== false)
                          }
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          style={{ accentColor: '#ffd700', width: '15px', height: '15px', cursor: 'pointer' }}
                        />
                        <span>Select All Units</span>
                      </label>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.1)',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '999px',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                        }}
                      >
                        {editableUnits.filter((u) => u.selected_for_publish !== false).length} of{' '}
                        {editableUnits.length} Units Selected
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="smm-btn-ghost sm"
                        onClick={expandAllReview}
                        title="Expand all units in review"
                      >
                        Expand All
                      </button>
                      <button
                        type="button"
                        className="smm-btn-ghost sm"
                        onClick={collapseAllReview}
                        title="Collapse all units in review"
                      >
                        Collapse All
                      </button>
                      <button
                        type="button"
                        className="smm-btn-ghost sm"
                        onClick={addUnitDraft}
                        title="Add a new custom Unit to this import draft"
                      >
                        <Plus size={12} />
                        <span>Add Unit</span>
                      </button>
                    </div>
                  </div>

                  <div className="smm-ai-table-header-row">
                    <div className="smm-ai-th-select" title="Toggle Selection">
                      <input
                        type="checkbox"
                        checked={editableUnits.length > 0 && editableUnits.every((u) => u.selected_for_publish !== false)}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        title="Select/Deselect All Units"
                        style={{ accentColor: '#ffd700', width: '15px', height: '15px', cursor: 'pointer' }}
                      />
                    </div>
                    <div className="smm-ai-th-num">Import / Unit #</div>
                    <div className="smm-ai-th-title">Unit Title & Scope</div>
                    <div className="smm-ai-th-actions">Actions</div>
                  </div>

                  <div className="smm-ai-review-tree">
                    {editableUnits.map((u, uIdx) => {
                      const isExpanded = expandedReviewUnits.has(u.unit_number || uIdx + 1);
                      const isSelected = u.selected_for_publish !== false;
                      return (
                        <div
                          key={uIdx}
                          className="smm-ai-unit-accordion"
                          style={{
                            opacity: isSelected ? 1 : 0.65,
                            borderLeft: isSelected
                              ? '3px solid #c084fc'
                              : '3px solid rgba(255, 255, 255, 0.15)',
                          }}
                        >
                          <div
                            className="smm-ai-unit-head"
                            onClick={() => toggleReviewUnit(u.unit_number || uIdx + 1)}
                          >
                            <div className="smm-ai-unit-left" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectUnit(uIdx)}
                                title="Check to include this unit in publish, uncheck to skip"
                                style={{
                                  accentColor: '#ffd700',
                                  width: '16px',
                                  height: '16px',
                                  cursor: 'pointer',
                                }}
                              />
                              <button
                                type="button"
                                className="smm-accordion-chevron"
                                onClick={() => toggleReviewUnit(u.unit_number || uIdx + 1)}
                                title={isExpanded ? 'Collapse Unit' : 'Expand Unit'}
                              >
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                              
                              {/* Dedicated Generated / Import Number Column */}
                              <div className="smm-ai-unit-num-wrap" title="Unit / Import Sequence Number">
                                <span className="smm-ai-unit-num-prefix">Unit</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="99"
                                  className="smm-ai-unit-num-input"
                                  value={u.unit_number || uIdx + 1}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || (uIdx + 1);
                                    updateUnitField(uIdx, 'unit_number', val);
                                    updateUnitField(uIdx, 'unit_code', `Unit ${val}`);
                                  }}
                                  title="Edit Unit / Import Number"
                                />
                              </div>

                              <input
                                type="text"
                                className="smm-ai-inline-input"
                                value={u.title}
                                onChange={(e) => updateUnitField(uIdx, 'title', e.target.value)}
                                placeholder="Unit Title"
                              />
                              {u.subject_name && (
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    color: '#38bdf8',
                                    background: 'rgba(56, 189, 248, 0.12)',
                                    border: '1px solid rgba(56, 189, 248, 0.25)',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '5px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {u.subject_name}
                                </span>
                              )}
                            </div>
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="smm-btn-ghost sm"
                                style={{
                                  padding: '0.2rem 0.55rem',
                                  fontSize: '0.75rem',
                                  borderColor: 'rgba(16, 185, 129, 0.35)',
                                  color: '#34d399',
                                }}
                                onClick={() => handlePublishApprovedSyllabus(u)}
                                title="Approve and publish ONLY this unit to PostgreSQL immediately"
                              >
                                <Check size={11} />
                                <span>Publish Unit</span>
                              </button>
                              <button
                                type="button"
                                className="smm-btn-mini-action"
                                onClick={() => addLessonDraft(uIdx)}
                                title="Add Lesson under this Unit"
                              >
                                <Plus size={12} />
                              </button>
                              <button
                                type="button"
                                className="smm-btn-mini-action delete"
                                onClick={() => removeUnitDraft(uIdx)}
                                title="Remove Unit"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="smm-ai-unit-body">
                              {u.lessons.length > 0 && (
                                <div className="smm-ai-lessons-header-bar">
                                  <span style={{ width: '85px', textAlign: 'center' }}>Lesson #</span>
                                  <span style={{ flex: 1, paddingLeft: '0.25rem' }}>Lesson Title</span>
                                  <span style={{ width: '120px' }}>Standard</span>
                                  <span style={{ width: '55px', textAlign: 'right' }}>Actions</span>
                                </div>
                              )}
                              {u.lessons.map((lesson, lIdx) => (
                                <div key={lIdx} className="smm-ai-lesson-card">
                                  <div className="smm-ai-lesson-head">
                                    <BookOpen size={13} className="text-amber" />
                                    <input
                                      type="text"
                                      className="smm-ai-inline-input"
                                      style={{ maxWidth: '85px', textAlign: 'center', fontWeight: 700 }}
                                      value={lesson.lesson_number}
                                      onChange={(e) =>
                                        updateLessonField(uIdx, lIdx, 'lesson_number', e.target.value)
                                      }
                                      placeholder="Num"
                                      title="Lesson Sequence Number"
                                    />
                                    <input
                                      type="text"
                                      className="smm-ai-inline-input"
                                      value={lesson.title}
                                      onChange={(e) => updateLessonField(uIdx, lIdx, 'title', e.target.value)}
                                      placeholder="Lesson Title"
                                    />
                                    <select
                                      className="smm-modal-select"
                                      style={{
                                        width: '120px',
                                        padding: '0.3rem 0.5rem',
                                        fontSize: '0.78rem',
                                      }}
                                      value={lesson.standard_number || 10}
                                      onChange={(e) =>
                                        updateLessonField(
                                          uIdx,
                                          lIdx,
                                          'standard_number',
                                          parseInt(e.target.value, 10)
                                        )
                                      }
                                    >
                                      {[6, 7, 8, 9, 10, 11, 12].map((std) => (
                                        <option key={std} value={std}>
                                          Class {std}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="smm-btn-mini-action"
                                      onClick={() => addTopicDraft(uIdx, lIdx)}
                                      title="Add Topic under this Lesson"
                                    >
                                      <Plus size={11} />
                                    </button>
                                    <button
                                      type="button"
                                      className="smm-btn-mini-action delete"
                                      onClick={() => removeLessonDraft(uIdx, lIdx)}
                                      title="Remove Lesson"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>

                                  {/* Topics under lesson */}
                                  <div className="smm-ai-topics-list">
                                    {lesson.topics.map((top, tIdx) => (
                                      <div key={tIdx} className="smm-ai-topic-chip">
                                        <input
                                          type="text"
                                          value={top.topic_name}
                                          onChange={(e) =>
                                            updateTopicDraft(uIdx, lIdx, tIdx, e.target.value)
                                          }
                                          placeholder="Topic name"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeTopicDraft(uIdx, lIdx, tIdx)}
                                          title="Remove Topic"
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="smm-modal-footer">
              {aiImportStep === 'upload' && (
                <>
                  <button
                    type="button"
                    className="smm-btn-ghost"
                    onClick={() => setAiImportModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="smm-btn-ai-import"
                    onClick={handleStartAnalysis}
                    disabled={
                      aiImportInputMode === 'pdf'
                        ? !aiImportFile
                        : aiImportPastedText.trim().length < 30
                    }
                  >
                    <Sparkles size={15} />
                    <span>Analyze & Extract Syllabus</span>
                  </button>
                </>
              )}

              {aiImportStep === 'review' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                      type="button"
                      className="smm-btn-ghost"
                      onClick={() => setAiImportStep('upload')}
                      disabled={isPublishing}
                    >
                      <ArrowLeft size={14} />
                      <span>Back to Upload</span>
                    </button>
                    <button
                      type="button"
                      className="smm-btn-ghost"
                      onClick={handleStartAnalysis}
                      disabled={isPublishing}
                      title="Re-run AI & Structural extraction on this PDF"
                    >
                      <RefreshCw size={13} />
                      <span>Regenerate</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                      type="button"
                      className="smm-btn-ghost"
                      onClick={() => setAiImportModalOpen(false)}
                      disabled={isPublishing}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="smm-btn-primary highlight"
                      onClick={() => handlePublishApprovedSyllabus()}
                      disabled={
                        isPublishing ||
                        editableUnits.filter((u) => u.selected_for_publish !== false).length === 0
                      }
                    >
                      {isPublishing ? (
                        <>
                          <RefreshCw size={14} className="spin-icon" />
                          <span>Publishing to Database...</span>
                        </>
                      ) : (
                        <>
                          <Check size={14} />
                          <span>
                            Approve & Publish Selected (
                            {editableUnits.filter((u) => u.selected_for_publish !== false).length} Units)
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyMaterialsManagement;
