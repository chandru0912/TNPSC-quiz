import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  Plus,
  Search,
  Eye,
  Edit3,
  Copy,
  Globe,
  FileX,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Users,
  BarChart3,
  X,
  Layers,
  Shuffle,
} from 'lucide-react';
import { apiFetch } from '../../utils/api';
import './MockTestManagement.css';

interface MockTestManagementProps {
  token: string;
  onPublishedCountChange?: (count: number) => void;
}

interface MockTestRow {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  categoryName: string;
  tnpscGroup: string;
  testCategory: 'lesson_wise' | 'unit_wise' | 'full_length';
  subject: string;
  standard: string | null;
  unit: string | null;
  lesson: string | null;
  questionsCount: number;
  assignedQuestionsCount: number;
  durationMinutes: number;
  totalMarks: number;
  marksPerQuestion: number;
  negativeMarking: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status: 'draft' | 'published' | 'scheduled' | 'archived';
  randomizePerAttempt?: boolean;
  avoidRepeatedQuestions?: boolean;
  includeIncorrectOnRetake?: boolean;
  questionLanguage?: 'en' | 'ta' | 'both';
  randomizeOptions?: boolean;
  startAt: string | null;
  endAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  attemptsCount: number;
  avgScorePercentage: number;
}

const TEST_CATEGORIES: { id: 'lesson_wise' | 'unit_wise' | 'full_length'; label: string }[] = [
  { id: 'lesson_wise', label: 'Lesson-wise' },
  { id: 'unit_wise', label: 'Unit-wise' },
  { id: 'full_length', label: 'Full-length' },
];

const formatTestCategoryLabel = (cat?: string) => {
  if (cat === 'lesson_wise') return 'Lesson-wise';
  if (cat === 'unit_wise') return 'Unit-wise';
  return 'Full-length';
};

interface MockTestStats {
  totalTests: number;
  publishedTests: number;
  draftTests: number;
  scheduledTests: number;
  totalStudentAttempts: number;
  averageStudentScore: number;
}

interface BankQuestion {
  id: number;
  category: string;
  unitId: number | null;
  classId: number | null;
  subject: string;
  lessonTitle: string;
  topic: string | null;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  status: string;
}

const TNPSC_GROUPS = ['Group 1', 'Group 2', 'Group 2A', 'Group 4'];
const SUBJECT_OPTIONS = [
  'General Studies',
  'Aptitude and Mental Ability',
  'General Tamil',
  'General English',
  'History',
  'Indian Polity',
  'Geography',
  'Economy',
  'General Science',
  'Unit 8 & Unit 9',
];
const STANDARD_OPTIONS = ['', '6th Standard', '7th Standard', '8th Standard', '9th Standard', '10th Standard', '11th Standard', '12th Standard'];
const UNIT_OPTIONS = ['', 'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Unit 6', 'Unit 7', 'Unit 8', 'Unit 9', 'Unit 10'];
const QUESTION_COUNT_PRESETS = [25, 50, 100, 150, 200];

const toLocalDatetimeInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const MockTestManagement: React.FC<MockTestManagementProps> = ({
  token,
  onPublishedCountChange,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [stats, setStats] = useState<MockTestStats>({
    totalTests: 0,
    publishedTests: 0,
    draftTests: 0,
    scheduledTests: 0,
    totalStudentAttempts: 0,
    averageStudentScore: 0,
  });
  const [tests, setTests] = useState<MockTestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // List Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');

  // Editor Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tnpscGroup, setTnpscGroup] = useState('Group 1');
  const [testCategory, setTestCategory] = useState<'lesson_wise' | 'unit_wise' | 'full_length'>('full_length');
  const [subject, setSubject] = useState('General Studies');
  const [standard, setStandard] = useState('');
  const [unit, setUnit] = useState('');
  const [lesson, setLesson] = useState('');
  const [availableLessons, setAvailableLessons] = useState<string[]>([]);
  const [totalQuestions, setTotalQuestions] = useState<number>(200);
  const [durationMinutes, setDurationMinutes] = useState<number>(180);
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(1.5);
  const [totalMarks, setTotalMarks] = useState<number>(300);
  const [negativeMarking, setNegativeMarking] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [randomizePerAttempt, setRandomizePerAttempt] = useState<boolean>(true);
  const [avoidRepeatedQuestions, setAvoidRepeatedQuestions] = useState<boolean>(true);
  const [includeIncorrectOnRetake, setIncludeIncorrectOnRetake] = useState<boolean>(false);
  const [questionLanguage, setQuestionLanguage] = useState<'both' | 'en' | 'ta'>('both');
  const [randomizeOptions, setRandomizeOptions] = useState<boolean>(false);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<BankQuestion[]>([]);

  // Question Bank Browser & Auto-Select State
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankGroup, setBankGroup] = useState('all');
  const [bankSubject, setBankSubject] = useState('all');
  const [bankStandard, setBankStandard] = useState('');
  const [bankUnit, setBankUnit] = useState('');
  const [bankDifficulty, setBankDifficulty] = useState('all');
  const [bankStatus, setBankStatus] = useState('published');
  const [autoSelectCount, setAutoSelectCount] = useState<number>(25);
  const [autoSelecting, setAutoSelecting] = useState(false);
  const [saving, setSaving] = useState(false);

  // View / Preview Modal
  const [previewModal, setPreviewModal] = useState<{
    title: string;
    meta: string;
    questions: BankQuestion[];
  } | null>(null);

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (groupFilter !== 'all') params.set('group', groupFilter);
      if (categoryFilter !== 'all') params.set('testCategory', categoryFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (subjectFilter !== 'all') params.set('subject', subjectFilter);

      const res = await apiFetch(`/api/admin/mock-tests?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setStats(data.data.stats);
        setTests(data.data.tests || []);
        if (onPublishedCountChange) {
          onPublishedCountChange(Number(data.data.stats?.publishedTests || 0));
        }
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to load mock tests.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Network error loading mock tests.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchOverview();
    }
  }, [token, groupFilter, categoryFilter, statusFilter, subjectFilter]);

  useEffect(() => {
    if (viewMode !== 'editor' || !token) return;
    const params = new URLSearchParams();
    params.set('group', tnpscGroup);
    if (subject) params.set('subject', subject);
    if (standard) params.set('standard', standard);
    if (unit) params.set('unit', unit);
    apiFetch(`/api/admin/mock-tests/syllabus-options?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status === 'success') {
          setAvailableLessons(d.data.lessons || []);
        }
      })
      .catch(() => {});
  }, [viewMode, token, tnpscGroup, subject, standard, unit]);

  const fetchQuestionBank = async () => {
    try {
      setBankLoading(true);
      const params = new URLSearchParams();
      if (bankGroup !== 'all') params.set('group', bankGroup);
      if (bankSubject !== 'all') params.set('subject', bankSubject);
      if (bankStandard) params.set('standard', bankStandard);
      if (bankUnit) params.set('unit', bankUnit);
      if (bankDifficulty !== 'all') params.set('difficulty', bankDifficulty);
      if (bankStatus !== 'all') params.set('status', bankStatus);
      if (bankSearch.trim()) params.set('search', bankSearch.trim());
      params.set('limit', '60');

      const res = await apiFetch(`/api/admin/mock-tests/question-bank?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setBankQuestions(data.data.questions || []);
        setBankTotal(Number(data.data.total || 0));
      }
    } catch {
      // handled silently in browser
    } finally {
      setBankLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'editor' && token) {
      fetchQuestionBank();
    }
  }, [viewMode, bankGroup, bankSubject, bankStandard, bankUnit, bankDifficulty, bankStatus]);

  const resetEditor = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setTnpscGroup('Group 1');
    setTestCategory('full_length');
    setSubject('Full Syllabus');
    setStandard('');
    setUnit('');
    setLesson('');
    setTotalQuestions(200);
    setDurationMinutes(180);
    setMarksPerQuestion(1.5);
    setTotalMarks(300);
    setNegativeMarking(0);
    setDifficulty('Medium');
    setRandomizePerAttempt(true);
    setAvoidRepeatedQuestions(true);
    setIncludeIncorrectOnRetake(false);
    setQuestionLanguage('both');
    setRandomizeOptions(false);
    setStartAt('');
    setEndAt('');
    setSelectedQuestions([]);
    setAutoSelectCount(200);
    setBankGroup('all');
    setBankSubject('all');
    setBankStandard('');
    setBankUnit('');
    setBankDifficulty('all');
    setBankSearch('');
    setMessage(null);
  };

  const handleTestCategoryChange = (nextCat: 'lesson_wise' | 'unit_wise' | 'full_length') => {
    setTestCategory(nextCat);
    if (subject === 'Full Syllabus' || !subject) {
      setSubject('General Studies');
    }
    if (nextCat === 'full_length') {
      setUnit('');
      setLesson('');
      setTotalQuestions(200);
      setAutoSelectCount(200);
      setDurationMinutes(180);
      setTotalMarks(Number((200 * marksPerQuestion).toFixed(2)));
      setRandomizePerAttempt(true);
    } else {
      setRandomizePerAttempt(false);
      if (totalQuestions === 200) {
        setTotalQuestions(25);
        setAutoSelectCount(25);
        setDurationMinutes(30);
        setTotalMarks(Number((25 * marksPerQuestion).toFixed(2)));
      }
    }
  };

  const openCreateEditor = () => {
    resetEditor();
    setViewMode('editor');
  };

  const openEditEditor = async (testId: number) => {
    try {
      setMessage(null);
      const res = await apiFetch(`/api/admin/mock-tests/${testId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        setMessage({ type: 'error', text: data.message || 'Failed to load mock test details.' });
        return;
      }
      const t: MockTestRow = data.data.test;
      setEditingId(t.id);
      setTitle(t.title);
      setDescription(t.description || '');
      setTnpscGroup(t.tnpscGroup || 'Group 1');
      setTestCategory(t.testCategory || 'full_length');
      setSubject(t.subject || 'General Studies');
      setStandard(t.standard || '');
      setUnit(t.unit || '');
      setLesson(t.lesson || '');
      setTotalQuestions(t.questionsCount || 25);
      setDurationMinutes(t.durationMinutes || 30);
      setMarksPerQuestion(t.marksPerQuestion || 1.5);
      setTotalMarks(t.totalMarks || 37.5);
      setNegativeMarking(t.negativeMarking || 0);
      setDifficulty(t.difficulty || 'Medium');
      setRandomizePerAttempt(Boolean(t.randomizePerAttempt));
      setAvoidRepeatedQuestions(t.avoidRepeatedQuestions !== false);
      setIncludeIncorrectOnRetake(Boolean(t.includeIncorrectOnRetake));
      setQuestionLanguage((t.questionLanguage as 'both' | 'en' | 'ta') || 'both');
      setRandomizeOptions(Boolean(t.randomizeOptions));
      setStartAt(toLocalDatetimeInput(t.startAt));
      setEndAt(toLocalDatetimeInput(t.endAt));
      setSelectedQuestions(data.data.questions || []);
      setAutoSelectCount(t.questionsCount || 25);
      setViewMode('editor');
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to open editor.' });
    }
  };

  const handleTotalQuestionsChange = (count: number) => {
    setTotalQuestions(count);
    setAutoSelectCount(count);
    setTotalMarks(Number((count * marksPerQuestion).toFixed(2)));
  };

  const handleMarksPerQuestionChange = (mpq: number) => {
    const clean = Number.isFinite(mpq) && mpq >= 0 ? mpq : 1.5;
    setMarksPerQuestion(clean);
    setTotalMarks(Number((totalQuestions * clean).toFixed(2)));
  };

  const selectedIdsSet = useMemo(() => new Set(selectedQuestions.map((q) => q.id)), [selectedQuestions]);

  const toggleSelectQuestion = (q: BankQuestion) => {
    if (selectedIdsSet.has(q.id)) {
      setSelectedQuestions((prev) => prev.filter((item) => item.id !== q.id));
    } else {
      if (selectedQuestions.length >= totalQuestions) {
        setMessage({
          type: 'error',
          text: `You have already selected ${totalQuestions} questions. Increase Total Questions or remove a question first.`,
        });
        return;
      }
      setSelectedQuestions((prev) => [...prev, q]);
    }
  };

  const handleAutoSelect = async () => {
    try {
      setAutoSelecting(true);
      setMessage(null);
      const remaining = Math.max(1, Math.min(autoSelectCount, totalQuestions - selectedQuestions.length || autoSelectCount));
      const res = await apiFetch('/api/admin/mock-tests/auto-select', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          group: bankGroup !== 'all' ? bankGroup : tnpscGroup,
          subject: bankSubject !== 'all' ? bankSubject : undefined,
          standard: bankStandard || undefined,
          unit: bankUnit || undefined,
          difficulty: bankDifficulty !== 'all' ? bankDifficulty : undefined,
          count: remaining,
          excludeIds: Array.from(selectedIdsSet),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        setMessage({ type: 'error', text: data.message || 'Not enough eligible questions found.' });
        return;
      }
      const incoming: BankQuestion[] = data.data.questions || [];
      setSelectedQuestions((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const q of incoming) {
          if (!seen.has(q.id) && merged.length < totalQuestions) {
            seen.add(q.id);
            merged.push(q);
          }
        }
        return merged;
      });
      setMessage({
        type: 'success',
        text: `Auto-selected ${incoming.length} real questions from Question Bank (${data.data.eligibleCount} eligible available).`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Auto-select failed.' });
    } finally {
      setAutoSelecting(false);
    }
  };

  const handleSaveTest = async (targetStatus: 'draft' | 'scheduled' | 'published') => {
    try {
      setSaving(true);
      setMessage(null);

      const payload = {
        title,
        description,
        tnpscGroup,
        testCategory,
        subject,
        standard: standard || null,
        unit: testCategory === 'full_length' ? null : unit || null,
        lesson: testCategory === 'lesson_wise' ? lesson || null : null,
        questionsCount: totalQuestions,
        durationMinutes,
        totalMarks,
        marksPerQuestion,
        negativeMarking,
        difficulty,
        status: targetStatus,
        randomizePerAttempt: testCategory === 'full_length' ? randomizePerAttempt : false,
        avoidRepeatedQuestions,
        includeIncorrectOnRetake,
        questionLanguage,
        randomizeOptions,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
        questionIds: selectedQuestions.map((q) => q.id),
      };

      const url = editingId ? `/api/admin/mock-tests/${editingId}` : '/api/admin/mock-tests';
      const method = editingId ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        setMessage({ type: 'error', text: data.message || 'Failed to save mock test.' });
        return;
      }

      setMessage({
        type: 'success',
        text:
          targetStatus === 'published'
            ? 'Mock Test published and live in Student Panel!'
            : targetStatus === 'scheduled'
              ? 'Mock Test scheduled successfully.'
              : 'Mock Test saved as Draft.',
      });
      setViewMode('list');
      await fetchOverview();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to save mock test.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (row: MockTestRow) => {
    const nextStatus = row.status === 'published' ? 'draft' : 'published';
    try {
      setMessage(null);
      const res = await apiFetch(`/api/admin/mock-tests/${row.id}/status`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        setMessage({ type: 'error', text: data.message || 'Status update failed.' });
        return;
      }
      setMessage({
        type: 'success',
        text: nextStatus === 'published' ? `"${row.title}" is now Published.` : `"${row.title}" moved to Draft.`,
      });
      await fetchOverview();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Status update failed.' });
    }
  };

  const handleDuplicate = async (row: MockTestRow) => {
    try {
      setMessage(null);
      const res = await apiFetch(`/api/admin/mock-tests/${row.id}/duplicate`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        setMessage({ type: 'error', text: data.message || 'Duplicate failed.' });
        return;
      }
      setMessage({ type: 'success', text: `Duplicated "${row.title}" as a new Draft.` });
      await fetchOverview();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Duplicate failed.' });
    }
  };

  const handleDelete = async (row: MockTestRow) => {
    if (!window.confirm(`Delete "${row.title}"? This action cannot be undone.`)) return;
    try {
      setMessage(null);
      const res = await apiFetch(`/api/admin/mock-tests/${row.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        setMessage({ type: 'error', text: data.message || 'Delete failed.' });
        return;
      }
      setMessage({ type: 'success', text: `Deleted "${row.title}".` });
      await fetchOverview();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Delete failed.' });
    }
  };

  const handleViewModal = async (row: MockTestRow) => {
    try {
      const res = await apiFetch(`/api/admin/mock-tests/${row.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setPreviewModal({
          title: row.title,
          meta: `${row.tnpscGroup} • ${row.subject} • ${data.data.questions.length}/${row.questionsCount} Questions • ${row.durationMinutes} min • ${row.totalMarks} Marks`,
          questions: data.data.questions || [],
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load test preview.' });
    }
  };

  return (
    <div className="mtm-container">
      {message && (
        <div className={`mtm-alert ${message.type}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      {viewMode === 'list' ? (
        <>
          {/* Top Action Bar */}
          <div className="mtm-topbar">
            <div className="mtm-topbar-left">
              <h2 className="mtm-topbar-title">
                <ClipboardCheck size={20} style={{ color: '#a78bfa' }} />
                <span>Mock Test Control Center</span>
              </h2>
              <p className="mtm-topbar-sub">
                Create, schedule, preview, and publish full-length TNPSC Mock Tests directly to the Student Panel.
              </p>
            </div>
            <button type="button" className="mtm-btn-primary" onClick={openCreateEditor}>
              <Plus size={18} />
              <span>Create Mock Test</span>
            </button>
          </div>

          {/* 6 Statistics Cards */}
          <div className="mtm-stats-grid">
            <div className="mtm-stat-card">
              <span className="mtm-stat-label">
                <span>Total Mock Tests</span>
                <Layers size={15} style={{ color: '#818cf8' }} />
              </span>
              <span className="mtm-stat-value">{stats.totalTests}</span>
            </div>
            <div className="mtm-stat-card">
              <span className="mtm-stat-label">
                <span>Published Tests</span>
                <Globe size={15} style={{ color: '#34d399' }} />
              </span>
              <span className="mtm-stat-value" style={{ color: '#34d399' }}>
                {stats.publishedTests}
              </span>
            </div>
            <div className="mtm-stat-card">
              <span className="mtm-stat-label">
                <span>Draft Tests</span>
                <FileX size={15} style={{ color: '#94a3b8' }} />
              </span>
              <span className="mtm-stat-value">{stats.draftTests}</span>
            </div>
            <div className="mtm-stat-card">
              <span className="mtm-stat-label">
                <span>Scheduled Tests</span>
                <Calendar size={15} style={{ color: '#fbbf24' }} />
              </span>
              <span className="mtm-stat-value" style={{ color: '#fbbf24' }}>
                {stats.scheduledTests}
              </span>
            </div>
            <div className="mtm-stat-card">
              <span className="mtm-stat-label">
                <span>Total Student Attempts</span>
                <Users size={15} style={{ color: '#38bdf8' }} />
              </span>
              <span className="mtm-stat-value">{stats.totalStudentAttempts}</span>
            </div>
            <div className="mtm-stat-card">
              <span className="mtm-stat-label">
                <span>Average Student Score</span>
                <BarChart3 size={15} style={{ color: '#c084fc' }} />
              </span>
              <span className="mtm-stat-value">{stats.averageStudentScore}%</span>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="mtm-filters-bar">
            <div className="mtm-search-wrap">
              <Search size={16} className="mtm-search-icon" />
              <input
                type="text"
                className="mtm-input"
                placeholder="Search mock tests by title or subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchOverview();
                }}
              />
            </div>
            <select
              className="mtm-select mtm-filter-select"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
            >
              <option value="all">All Groups</option>
              {TNPSC_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select
              className="mtm-select mtm-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {TEST_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              className="mtm-select mtm-filter-select"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <option value="all">All Subjects</option>
              {SUBJECT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              className="mtm-select mtm-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <button type="button" className="mtm-btn-secondary" onClick={fetchOverview}>
              <Search size={15} />
              <span>Filter</span>
            </button>
          </div>

          {/* Mock Test Table */}
          <div className="mtm-table-card">
            <div className="mtm-table-wrap">
              <table className="mtm-table">
                <thead>
                  <tr>
                    <th>Test Name</th>
                    <th>TNPSC Group</th>
                    <th>Subject</th>
                    <th>Questions</th>
                    <th>Duration</th>
                    <th>Total Marks</th>
                    <th>Status</th>
                    <th>Published Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        Loading mock tests from PostgreSQL...
                      </td>
                    </tr>
                  ) : tests.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        No mock tests found matching your filters. Click "Create Mock Test" to build one.
                      </td>
                    </tr>
                  ) : (
                    tests.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="mtm-test-title-cell">{row.title}</div>
                          <div className="mtm-test-sub">
                            {row.attemptsCount} attempt{row.attemptsCount === 1 ? '' : 's'}
                            {row.negativeMarking > 0 ? ` • -${row.negativeMarking} neg` : ''}
                          </div>
                        </td>
                        <td>
                          <span className="mtm-badge mtm-badge-group">{row.tnpscGroup}</span>
                          <div className="mtm-test-sub" style={{ marginTop: '0.25rem' }}>
                            {formatTestCategoryLabel(row.testCategory)}
                            {row.unit ? ` • ${row.unit}` : ''}
                            {row.lesson ? ` • ${row.lesson}` : ''}
                          </div>
                        </td>
                        <td>{row.subject || 'General Studies'}</td>
                        <td>
                          <strong>{row.assignedQuestionsCount > 0 ? row.assignedQuestionsCount : row.questionsCount}</strong>
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}> / {row.questionsCount}</span>
                        </td>
                        <td>{row.durationMinutes} min</td>
                        <td>{row.totalMarks}</td>
                        <td>
                          <span className={`mtm-badge mtm-badge-${row.status}`}>
                            {row.status === 'published'
                              ? 'Published'
                              : row.status === 'scheduled'
                                ? 'Scheduled'
                                : 'Draft'}
                          </span>
                        </td>
                        <td>
                          {row.publishedAt
                            ? new Date(row.publishedAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : row.startAt
                              ? `Starts ${new Date(row.startAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`
                              : '—'}
                        </td>
                        <td>
                          <div className="mtm-actions-row">
                            <button
                              type="button"
                              className="mtm-icon-btn"
                              title="View / Preview Questions"
                              onClick={() => handleViewModal(row)}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              className="mtm-icon-btn"
                              title="Edit Mock Test"
                              onClick={() => openEditEditor(row.id)}
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              className="mtm-icon-btn"
                              title="Duplicate Mock Test"
                              onClick={() => handleDuplicate(row)}
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              type="button"
                              className="mtm-icon-btn publish"
                              title={row.status === 'published' ? 'Unpublish (Move to Draft)' : 'Publish Now'}
                              onClick={() => handleTogglePublish(row)}
                            >
                              {row.status === 'published' ? <FileX size={15} /> : <Globe size={15} />}
                            </button>
                            <button
                              type="button"
                              className="mtm-icon-btn danger"
                              title="Delete Mock Test"
                              onClick={() => handleDelete(row)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* CREATE / EDIT MOCK TEST VIEW */
        <>
          <div className="mtm-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <button
                type="button"
                className="mtm-btn-secondary"
                onClick={() => {
                  setViewMode('list');
                  setMessage(null);
                }}
              >
                <ArrowLeft size={16} />
                <span>Back to Mock Tests</span>
              </button>
              <div>
                <h2 className="mtm-topbar-title">
                  {editingId ? 'Edit Mock Test' : 'Create New Mock Test'}
                </h2>
                <p className="mtm-topbar-sub">
                  Configure exam rules and select verified questions from the PostgreSQL Question Bank.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              <button
                type="button"
                className="mtm-btn-secondary"
                onClick={() =>
                  setPreviewModal({
                    title: title || 'Untitled Mock Test Preview',
                    meta: `${tnpscGroup} • ${subject} • ${selectedQuestions.length}/${totalQuestions} Selected • ${durationMinutes} min • ${totalMarks} Marks`,
                    questions: selectedQuestions,
                  })
                }
              >
                <Eye size={16} />
                <span>Preview ({selectedQuestions.length})</span>
              </button>
              <button
                type="button"
                className="mtm-btn-secondary"
                disabled={saving}
                onClick={() => handleSaveTest('draft')}
              >
                <span>Save as Draft</span>
              </button>
              <button
                type="button"
                className="mtm-btn-secondary"
                disabled={saving}
                onClick={() => handleSaveTest('scheduled')}
              >
                <Calendar size={15} />
                <span>Schedule Test</span>
              </button>
              <button
                type="button"
                className="mtm-btn-success"
                disabled={saving}
                onClick={() => handleSaveTest('published')}
              >
                <Globe size={16} />
                <span>{saving ? 'Publishing...' : 'Publish Now'}</span>
              </button>
            </div>
          </div>

          <div className="mtm-builder-grid">
            {/* Left Column: 14 Configuration Fields */}
            <div className="mtm-glass-panel">
              <h3 className="mtm-panel-title">
                <span>1. Mock Test Configuration</span>
                <span className="mtm-chip">{selectedQuestions.length} / {totalQuestions} Qs</span>
              </h3>

              <div className="mtm-form-grid">
                <div className="mtm-field full">
                  <label className="mtm-label">1. Mock Test Title *</label>
                  <input
                    type="text"
                    className="mtm-input"
                    placeholder="e.g. TNPSC Group 1 Prelims Full Mock Test 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="mtm-field full">
                  <label className="mtm-label">2. Test Description</label>
                  <textarea
                    className="mtm-textarea"
                    rows={2}
                    placeholder="Syllabus coverage, exam pattern notes, and instructions..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">3. TNPSC Group *</label>
                  <select className="mtm-select" value={tnpscGroup} onChange={(e) => setTnpscGroup(e.target.value)}>
                    {TNPSC_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">Test Category *</label>
                  <select
                    className="mtm-select"
                    value={testCategory}
                    onChange={(e) => handleTestCategoryChange(e.target.value as 'lesson_wise' | 'unit_wise' | 'full_length')}
                  >
                    {TEST_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">4. Subject Selection *</label>
                  <select className="mtm-select" value={subject} onChange={(e) => setSubject(e.target.value)}>
                    {SUBJECT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">5. Standard (6th–12th)</label>
                  <select className="mtm-select" value={standard} onChange={(e) => setStandard(e.target.value)}>
                    {STANDARD_OPTIONS.map((std) => (
                      <option key={std || 'all'} value={std}>
                        {std || 'All Standards'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">Question Language</label>
                  <select
                    className="mtm-select"
                    value={questionLanguage}
                    onChange={(e) => setQuestionLanguage(e.target.value as 'both' | 'en' | 'ta')}
                  >
                    <option value="both">Both (English &amp; Tamil)</option>
                    <option value="en">English Only</option>
                    <option value="ta">Tamil Only</option>
                  </select>
                </div>

                {testCategory !== 'full_length' && (
                  <>
                    <div className="mtm-field">
                      <label className="mtm-label">6. Unit Selection {testCategory === 'unit_wise' ? '*' : '(Optional)'}</label>
                      <select className="mtm-select" value={unit} onChange={(e) => setUnit(e.target.value)}>
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u || 'all'} value={u}>
                            {u || 'All Units'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {testCategory === 'lesson_wise' && (
                      <div className="mtm-field">
                        <label className="mtm-label">7. Lesson Selection *</label>
                        <input
                          type="text"
                          list="mtm-lesson-suggestions"
                          className="mtm-input"
                          placeholder="Select or type lesson title..."
                          value={lesson}
                          onChange={(e) => setLesson(e.target.value)}
                        />
                        <datalist id="mtm-lesson-suggestions">
                          {availableLessons.map((l) => (
                            <option key={l} value={l} />
                          ))}
                        </datalist>
                      </div>
                    )}
                  </>
                )}

                {testCategory === 'full_length' && (
                  <div className="mtm-field full" style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                    <label className="mtm-label" style={{ color: '#c4b5fd', marginBottom: '0.25rem' }}>
                      Full-length Syllabus &amp; Retake Settings
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: '#e2e8f0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={randomizePerAttempt}
                        onChange={(e) => setRandomizePerAttempt(e.target.checked)}
                      />
                      <span>Randomize questions across full syllabus on each student attempt (Approved Question Bank)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: '#e2e8f0', cursor: 'pointer', marginTop: '0.35rem' }}>
                      <input
                        type="checkbox"
                        checked={avoidRepeatedQuestions}
                        onChange={(e) => setAvoidRepeatedQuestions(e.target.checked)}
                      />
                      <span>Avoid repeating previously attempted questions for the student</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: '#e2e8f0', cursor: 'pointer', marginTop: '0.35rem' }}>
                      <input
                        type="checkbox"
                        checked={includeIncorrectOnRetake}
                        onChange={(e) => setIncludeIncorrectOnRetake(e.target.checked)}
                      />
                      <span>Prioritize previously incorrect questions on retakes</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: '#e2e8f0', cursor: 'pointer', marginTop: '0.35rem' }}>
                      <input
                        type="checkbox"
                        checked={randomizeOptions}
                        onChange={(e) => setRandomizeOptions(e.target.checked)}
                      />
                      <span>Randomize answer option order (A/B/C/D)</span>
                    </label>
                  </div>
                )}

                <div className="mtm-field">
                  <label className="mtm-label">8. Total Questions *</label>
                  <select
                    className="mtm-select"
                    value={totalQuestions}
                    onChange={(e) => handleTotalQuestionsChange(Number(e.target.value))}
                  >
                    {QUESTION_COUNT_PRESETS.map((cnt) => (
                      <option key={cnt} value={cnt}>
                        {cnt} Questions
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">9. Test Duration (Minutes) *</label>
                  <input
                    type="number"
                    min={5}
                    max={360}
                    className="mtm-input"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value) || 30))}
                  />
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">11. Marks Per Question *</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    className="mtm-input"
                    value={marksPerQuestion}
                    onChange={(e) => handleMarksPerQuestionChange(Number(e.target.value))}
                  />
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">10. Total Marks *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    className="mtm-input"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value) || 0)}
                  />
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">12. Negative Marking (Per Wrong)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    className="mtm-input"
                    value={negativeMarking}
                    onChange={(e) => setNegativeMarking(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">Difficulty</label>
                  <select
                    className="mtm-select"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">13. Start Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    className="mtm-input"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                  />
                </div>

                <div className="mtm-field">
                  <label className="mtm-label">14. End Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    className="mtm-input"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                  />
                </div>
              </div>

              {/* Selected Questions Summary */}
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span className="mtm-label">
                    Selected Questions ({selectedQuestions.length} / {totalQuestions})
                  </span>
                  {selectedQuestions.length > 0 && (
                    <button
                      type="button"
                      className="mtm-btn-secondary"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.76rem' }}
                      onClick={() => setSelectedQuestions([])}
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="mtm-qbank-list" style={{ maxHeight: '220px' }}>
                  {selectedQuestions.length === 0 ? (
                    <div style={{ fontSize: '0.83rem', color: '#94a3b8', padding: '0.75rem', border: '1px dashed rgba(255,255,255,0.14)', borderRadius: '10px' }}>
                      No questions selected yet. Use the Question Bank browser or "Auto-Select Random" on the right.
                    </div>
                  ) : (
                    selectedQuestions.map((q, idx) => (
                      <div key={q.id} className="mtm-q-card selected" style={{ padding: '0.6rem 0.8rem' }}>
                        <div className="mtm-q-header">
                          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                            {idx + 1}. {q.question}
                          </span>
                          <button
                            type="button"
                            className="mtm-icon-btn danger"
                            style={{ width: '26px', height: '26px', flexShrink: 0 }}
                            onClick={() => toggleSelectQuestion(q)}
                            title="Remove question"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: 7. Question Selection Interface (Manual + Auto-Select) */}
            <div className="mtm-glass-panel">
              <h3 className="mtm-panel-title">
                <span>2. Question Bank Selection</span>
                <span className="mtm-chip">{bankTotal} Available</span>
              </h3>

              {/* Auto-Select Box */}
              <div className="mtm-auto-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 600, fontSize: '0.88rem', color: '#c4b5fd' }}>
                    <Sparkles size={16} />
                    <span>Auto-Select Random Questions (Real DB Only)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      className="mtm-input"
                      style={{ width: '80px', padding: '0.42rem 0.6rem' }}
                      value={autoSelectCount}
                      onChange={(e) => setAutoSelectCount(Math.max(1, Number(e.target.value) || 1))}
                    />
                    <button
                      type="button"
                      className="mtm-btn-primary"
                      style={{ padding: '0.48rem 0.9rem', fontSize: '0.82rem' }}
                      disabled={autoSelecting}
                      onClick={handleAutoSelect}
                    >
                      <Shuffle size={14} />
                      <span>{autoSelecting ? 'Selecting...' : 'Auto-Select'}</span>
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#cbd5e1' }}>
                  Uses filters below (Group, Subject, Standard, Unit, Difficulty) and prevents duplicate questions.
                </div>
              </div>

              {/* Question Bank Filters */}
              <div className="mtm-form-grid">
                <div className="mtm-field full">
                  <div className="mtm-search-wrap">
                    <Search size={15} className="mtm-search-icon" />
                    <input
                      type="text"
                      className="mtm-input"
                      placeholder="Search question text, topic, or lesson..."
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') fetchQuestionBank();
                      }}
                    />
                  </div>
                </div>
                <select className="mtm-select" value={bankGroup} onChange={(e) => setBankGroup(e.target.value)}>
                  <option value="all">All Groups</option>
                  {TNPSC_GROUPS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select className="mtm-select" value={bankSubject} onChange={(e) => setBankSubject(e.target.value)}>
                  <option value="all">All Subjects</option>
                  {SUBJECT_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select className="mtm-select" value={bankStandard} onChange={(e) => setBankStandard(e.target.value)}>
                  {STANDARD_OPTIONS.map((std) => (
                    <option key={std || 'all'} value={std}>{std || 'All Standards'}</option>
                  ))}
                </select>
                <select className="mtm-select" value={bankUnit} onChange={(e) => setBankUnit(e.target.value)}>
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u || 'all'} value={u}>{u || 'All Units'}</option>
                  ))}
                </select>
                <select className="mtm-select" value={bankDifficulty} onChange={(e) => setBankDifficulty(e.target.value)}>
                  <option value="all">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
                <select className="mtm-select" value={bankStatus} onChange={(e) => setBankStatus(e.target.value)}>
                  <option value="published">Published Only</option>
                  <option value="all">All Statuses</option>
                  <option value="staging">Staging</option>
                </select>
              </div>

              <button type="button" className="mtm-btn-secondary" onClick={fetchQuestionBank}>
                <Search size={14} />
                <span>Search Question Bank</span>
              </button>

              {/* Question List */}
              <div className="mtm-qbank-list">
                {bankLoading ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                    Loading Question Bank...
                  </div>
                ) : bankQuestions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
                    No questions found matching these filters.
                  </div>
                ) : (
                  bankQuestions.map((q) => {
                    const isSelected = selectedIdsSet.has(q.id);
                    return (
                      <div key={q.id} className={`mtm-q-card ${isSelected ? 'selected' : ''}`}>
                        <div className="mtm-q-header">
                          <div className="mtm-q-text">#{q.id} — {q.question}</div>
                          <button
                            type="button"
                            className={isSelected ? 'mtm-btn-primary' : 'mtm-btn-secondary'}
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.76rem', flexShrink: 0 }}
                            onClick={() => toggleSelectQuestion(q)}
                          >
                            {isSelected ? 'Selected' : '+ Add'}
                          </button>
                        </div>
                        <div className="mtm-q-options">
                          {(q.options || []).map((opt, idx) => (
                            <div
                              key={idx}
                              className={`mtm-q-opt ${idx === q.correctAnswer ? 'correct' : ''}`}
                            >
                              {String.fromCharCode(65 + idx)}. {opt} {idx === q.correctAnswer ? '✓' : ''}
                            </div>
                          ))}
                        </div>
                        <div className="mtm-q-meta">
                          <span className="mtm-chip">{q.subject}</span>
                          {q.topic && <span className="mtm-chip">{q.topic}</span>}
                          <span className="mtm-chip">{q.difficulty}</span>
                          <span className="mtm-chip">{q.status}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Preview Modal */}
      {previewModal && (
        <div className="mtm-modal-backdrop" onClick={() => setPreviewModal(null)}>
          <div className="mtm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mtm-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#f8fafc' }}>{previewModal.title}</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>{previewModal.meta}</p>
              </div>
              <button type="button" className="mtm-icon-btn" onClick={() => setPreviewModal(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="mtm-modal-body">
              {previewModal.questions.length === 0 ? (
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
                  No questions assigned to this mock test yet.
                </div>
              ) : (
                previewModal.questions.map((q, idx) => (
                  <div key={q.id} className="mtm-q-card">
                    <div className="mtm-q-text">
                      Q{idx + 1}. {q.question}
                    </div>
                    <div className="mtm-q-options">
                      {(q.options || []).map((opt, oIdx) => (
                        <div key={oIdx} className={`mtm-q-opt ${oIdx === q.correctAnswer ? 'correct' : ''}`}>
                          {String.fromCharCode(65 + oIdx)}. {opt} {oIdx === q.correctAnswer ? '✓ (Admin Answer Key)' : ''}
                        </div>
                      ))}
                    </div>
                    <div className="mtm-q-meta">
                      <span className="mtm-chip">{q.subject}</span>
                      {q.topic && <span className="mtm-chip">{q.topic}</span>}
                      <span className="mtm-chip">{q.difficulty}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
