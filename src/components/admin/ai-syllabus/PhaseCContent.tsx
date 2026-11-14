import React, { useState, useMemo } from 'react';
import type { CanonicalUnitDraft, GeneratedNotesDraft, GeneratedMCQDraft } from './types';
import {
  FileText,
  HelpCircle,
  Check,
  Loader2,
  BookOpen,
  AlertCircle,
  Search,
  Eye,
  Layers,
} from 'lucide-react';
import { apiFetch } from '../../../utils/api';
import { compareLessons } from '../../../utils/naturalSort';

interface PhaseCContentProps {
  units: CanonicalUnitDraft[];
  notesMap: Record<string, GeneratedNotesDraft>;
  setNotesMap: React.Dispatch<React.SetStateAction<Record<string, GeneratedNotesDraft>>>;
  mcqsMap: Record<string, GeneratedMCQDraft[]>;
  setMcqsMap: React.Dispatch<React.SetStateAction<Record<string, GeneratedMCQDraft[]>>>;
  onNext: () => void;
  onBack: () => void;
}

export const PhaseCContent: React.FC<PhaseCContentProps> = ({
  units,
  notesMap,
  setNotesMap,
  mcqsMap,
  setMcqsMap,
  onNext,
  onBack,
}) => {
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [selectedPreviewKey, setSelectedPreviewKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'mcqs'>('notes');
  const [contentError, setContentError] = useState<{ message: string; statusCode?: number } | null>(null);

  // Filters state
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedStandard, setSelectedStandard] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Flatten and deduplicate all publishable lessons across units
  const allLessons = useMemo(() => {
    const list: Array<{
      key: string;
      id: string;
      subject_slug: string;
      subject_name: string;
      unit_number: number;
      unit_code: string;
      unit_title: string;
      standard: number;
      lesson_number: string;
      title: string;
      subject: string;
      topics: string[];
    }> = [];

    const seenKeys = new Set<string>();

    for (const u of units) {
      if (u.selected_for_publish === false) continue;
      const subSlug = u.subject_slug || 'general-studies';
      const subName = u.subject_name || 'General Studies';

      for (const l of u.lessons || []) {
        if (l.selected_for_publish === false) continue;
        const key = `${subSlug}_${u.unit_number}_${l.standard_number}_${l.lesson_number}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const rawTopics = Array.isArray(l.topics) ? l.topics : [];
        const cleanTopics = rawTopics
          .map((t: any) => (typeof t === 'string' ? t.trim() : String(t.topic_name || t.title || '').trim()))
          .filter(Boolean);

        list.push({
          key,
          id: l.id || key,
          subject_slug: subSlug,
          subject_name: subName,
          unit_number: u.unit_number,
          unit_code: u.unit_code || `Unit ${u.unit_number}`,
          unit_title: u.title,
          standard: l.standard_number,
          lesson_number: l.lesson_number,
          title: l.title,
          subject: l.textbook_title || u.title,
          topics: cleanTopics,
        });
      }
    }

    return list.sort(compareLessons);
  }, [units]);

  // Standard-wise counts
  const standardCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const l of allLessons) {
      counts[l.standard] = (counts[l.standard] || 0) + 1;
    }
    return counts;
  }, [allLessons]);

  // Distinct subjects in allLessons
  const availableSubjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const l of allLessons) {
      if (!map.has(l.subject_slug)) {
        map.set(l.subject_slug, { id: l.subject_slug, name: l.subject_name, count: 0 });
      }
      map.get(l.subject_slug)!.count++;
    }
    return Array.from(map.values());
  }, [allLessons]);

  // Filtered lessons
  const filteredLessons = useMemo(() => {
    return allLessons.filter((l) => {
      if (selectedSubject !== 'all' && l.subject_slug !== selectedSubject) {
        return false;
      }
      if (selectedStandard !== 'all' && l.standard !== Number(selectedStandard)) {
        return false;
      }
      if (selectedUnit !== 'all' && l.unit_number !== Number(selectedUnit)) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = l.title.toLowerCase().includes(query);
        const matchesUnit = l.unit_title.toLowerCase().includes(query);
        const matchesTopics = l.topics.some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesUnit && !matchesTopics) {
          return false;
        }
      }
      return true;
    }).sort(compareLessons);
  }, [allLessons, selectedSubject, selectedStandard, selectedUnit, searchQuery]);

  // Handle single lesson note generation
  const handleGenerateNotes = async (item: typeof allLessons[0]) => {
    setGeneratingKey(`notes_${item.key}`);
    setContentError(null);
    try {
      const res = await apiFetch('/api/study-management/ai-import/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonTitle: item.title,
          standard: item.standard,
          topics: item.topics,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw { message: data.message || 'Note generation failed.', statusCode: data.statusCode || res.status };
      }
      if (data.notes) {
        setNotesMap((prev) => ({ ...prev, [item.key]: data.notes }));
        setSelectedPreviewKey(item.key);
        setActiveTab('notes');
      }
    } catch (err: any) {
      console.error('Note generation failed', err);
      setContentError({
        message: err.message || 'Failed to generate study notes.',
        statusCode: err.statusCode || 500,
      });
    } finally {
      setGeneratingKey(null);
    }
  };

  // Handle single lesson MCQ generation
  const handleGenerateMCQs = async (item: typeof allLessons[0]) => {
    setGeneratingKey(`mcqs_${item.key}`);
    setContentError(null);
    try {
      const res = await apiFetch('/api/study-management/ai-import/generate-mcqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonTitle: item.title,
          standard: item.standard,
          topics: item.topics,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw { message: data.message || 'MCQ generation failed.', statusCode: data.statusCode || res.status };
      }
      if (Array.isArray(data.mcqs)) {
        setMcqsMap((prev) => ({ ...prev, [item.key]: data.mcqs }));
        setSelectedPreviewKey(item.key);
        setActiveTab('mcqs');
      }
    } catch (err: any) {
      console.error('MCQ generation failed', err);
      setContentError({
        message: err.message || 'Failed to generate MCQs.',
        statusCode: err.statusCode || 500,
      });
    } finally {
      setGeneratingKey(null);
    }
  };

  const previewNotes = selectedPreviewKey ? notesMap[selectedPreviewKey] : null;
  const previewMCQs = selectedPreviewKey ? mcqsMap[selectedPreviewKey] : null;

  const getStandardBadgeColor = (std: number) => {
    switch (std) {
      case 6:
        return '#3b82f6';
      case 7:
        return '#06b6d4';
      case 8:
        return '#10b981';
      case 9:
        return '#8b5cf6';
      case 10:
        return '#f59e0b';
      case 11:
        return '#ec4899';
      case 12:
        return '#6366f1';
      default:
        return '#64748b';
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '1.5rem', minHeight: '480px' }}>
      {/* Left Column: Lesson list with generation buttons & filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Header & count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.98rem', color: '#f1f5f9', fontWeight: 700 }}>
              10 & 11. Content Synthesis ({filteredLessons.length} of {allLessons.length} Lessons)
            </h4>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Standard-wise isolated lessons • High-yield Notes & MCQs
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
            Ready for Synthesis
          </span>
        </div>

        {/* Subject Filter Pills */}
        {availableSubjects.length > 1 && (
          <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
            <button
              type="button"
              className={`asw-std-tab ${selectedSubject === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedSubject('all')}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
            >
              All Subjects ({allLessons.length})
            </button>
            {availableSubjects.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className={`asw-std-tab ${selectedSubject === sub.id ? 'active' : ''}`}
                onClick={() => setSelectedSubject(sub.id)}
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
              >
                {sub.name} ({sub.count})
              </button>
            ))}
          </div>
        )}

        {/* Standard Tabs Filter */}
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
          <button
            type="button"
            className={`asw-std-tab ${selectedStandard === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedStandard('all')}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
          >
            All Standards ({allLessons.length})
          </button>
          {[6, 7, 8, 9, 10, 11, 12].map((std) => {
            const count = standardCounts[std] || 0;
            return (
              <button
                key={std}
                type="button"
                className={`asw-std-tab ${selectedStandard === String(std) ? 'active' : ''}`}
                onClick={() => setSelectedStandard(String(std))}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
              >
                Class {std} ({count})
              </button>
            );
          })}
        </div>

        {/* Filter controls: Unit dropdown + Live Search input */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div style={{ position: 'relative' }}>
            <select
              className="asw-select"
              style={{ width: '100%', fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
            >
              <option value="all">All Units ({units.length} Units)</option>
              {units.map((u) => (
                <option key={u.unit_number} value={String(u.unit_number)}>
                  {u.unit_code}: {u.title}
                </option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', color: '#94a3b8' }} />
            <input
              type="text"
              className="asw-input"
              style={{ width: '100%', fontSize: '0.78rem', padding: '0.35rem 0.6rem 0.35rem 1.6rem' }}
              placeholder="Search lessons or topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {contentError && (
          <div style={{ padding: '0.65rem 0.85rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: '#f87171', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <div>
              {contentError.statusCode && (
                <span style={{ fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '4px', background: contentError.statusCode === 503 ? '#f59e0b' : '#ef4444', color: '#fff', marginRight: '0.35rem', fontSize: '0.68rem' }}>
                  {contentError.statusCode === 503 ? '503 BUSY' : `${contentError.statusCode}`}
                </span>
              )}
              <span>{contentError.message}</span>
            </div>
          </div>
        )}

        {/* Scrollable Lesson Cards Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '490px', overflowY: 'auto', paddingRight: '4px' }}>
          {filteredLessons.length === 0 ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(30, 41, 59, 0.3)', borderRadius: '8px' }}>
              <Layers size={24} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>No lessons found matching the selected filters.</p>
            </div>
          ) : (
            filteredLessons.map((item) => {
              const hasNotes = Boolean(notesMap[item.key]);
              const hasMCQs = Boolean(mcqsMap[item.key]);
              const isSelected = selectedPreviewKey === item.key;
              const isGenNotes = generatingKey === `notes_${item.key}`;
              const isGenMCQs = generatingKey === `mcqs_${item.key}`;
              const badgeBg = getStandardBadgeColor(item.standard);

              return (
                <div
                  key={item.id}
                  style={{
                    background: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'rgba(30, 41, 59, 0.5)',
                    border: `1px solid ${isSelected ? '#6366f1' : 'rgba(148, 163, 184, 0.15)'}`,
                    borderRadius: '8px',
                    padding: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => setSelectedPreviewKey(item.key)}
                >
                  {/* Card Header: Standard & Unit Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: badgeBg,
                          color: '#fff',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                        }}
                      >
                        Class {item.standard} • Lesson {item.lesson_number}
                      </span>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          background: 'rgba(148, 163, 184, 0.15)',
                          color: '#cbd5e1',
                          padding: '0.12rem 0.4rem',
                          borderRadius: '4px',
                        }}
                      >
                        {item.unit_code}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {hasNotes && (
                        <span style={{ fontSize: '0.68rem', color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Check size={10} /> Notes
                        </span>
                      )}
                      {hasMCQs && (
                        <span style={{ fontSize: '0.68rem', color: '#818cf8', background: 'rgba(129, 140, 248, 0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <Check size={10} /> MCQs
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Lesson Title */}
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc', margin: '0.45rem 0 0.3rem' }}>
                    {item.title}
                  </div>

                  {/* Topics Chips */}
                  {item.topics.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', margin: '0.35rem 0' }}>
                      {item.topics.slice(0, 3).map((topic, tIdx) => (
                        <span
                          key={tIdx}
                          style={{
                            fontSize: '0.68rem',
                            color: '#94a3b8',
                            background: 'rgba(15, 23, 42, 0.6)',
                            border: '1px solid rgba(148, 163, 184, 0.12)',
                            borderRadius: '4px',
                            padding: '0.1rem 0.35rem',
                          }}
                        >
                          {topic}
                        </span>
                      ))}
                      {item.topics.length > 3 && (
                        <span style={{ fontSize: '0.65rem', color: '#64748b', padding: '0.1rem 0.2rem' }}>
                          +{item.topics.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="asw-btn-ghost"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateNotes(item);
                      }}
                      disabled={Boolean(generatingKey)}
                    >
                      {isGenNotes ? <Loader2 size={12} className="spin-icon" /> : <FileText size={12} />}
                      <span>{hasNotes ? 'Regen Notes' : 'Gen Notes'}</span>
                    </button>

                    <button
                      type="button"
                      className="asw-btn-ghost"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateMCQs(item);
                      }}
                      disabled={Boolean(generatingKey)}
                    >
                      {isGenMCQs ? <Loader2 size={12} className="spin-icon" /> : <HelpCircle size={12} />}
                      <span>{hasMCQs ? 'Regen MCQs' : 'Gen MCQs'}</span>
                    </button>

                    <button
                      type="button"
                      className="asw-btn-ghost"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem', display: 'flex', alignItems: 'center', gap: '3px', marginLeft: 'auto', color: isSelected ? '#a5b4fc' : '#94a3b8' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPreviewKey(item.key);
                      }}
                    >
                      <Eye size={12} />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Preview Drawer for Notes & MCQs */}
      <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid rgba(148, 163, 184, 0.15)', background: 'rgba(15, 23, 42, 0.9)' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`asw-std-tab ${activeTab === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              <FileText size={13} style={{ display: 'inline', marginRight: '4px' }} />
              Bilingual Study Notes
            </button>
            <button
              type="button"
              className={`asw-std-tab ${activeTab === 'mcqs' ? 'active' : ''}`}
              onClick={() => setActiveTab('mcqs')}
            >
              <HelpCircle size={13} style={{ display: 'inline', marginRight: '4px' }} />
              TNPSC MCQs (5 Qs)
            </button>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {selectedPreviewKey ? selectedPreviewKey.replace(/_/g, ' • ') : 'Select a lesson to preview'}
          </span>
        </div>

        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, maxHeight: '460px' }}>
          {activeTab === 'notes' ? (
            previewNotes ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '0.75rem', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: '#c084fc', textTransform: 'uppercase', fontWeight: 700 }}>Summary</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#e2e8f0', lineHeight: 1.4 }}>
                    {previewNotes.summary}
                  </p>
                </div>

                <div>
                  <h5 style={{ margin: '0 0 0.4rem', color: '#38bdf8', fontSize: '0.85rem' }}>Key Exam Points:</h5>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                    {previewNotes.key_points.map((kp, idx) => (
                      <li key={idx}>{kp}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: '0.75rem' }}>
                  <h5 style={{ margin: '0 0 0.4rem', color: '#34d399', fontSize: '0.85rem' }}>English Notes:</h5>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {previewNotes.content_english}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.1)', paddingTop: '0.75rem' }}>
                  <h5 style={{ margin: '0 0 0.4rem', color: '#fbbf24', fontSize: '0.85rem' }}>தமிழ் குறிப்புகள் (Tamil Notes):</h5>
                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {previewNotes.content_tamil}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                <BookOpen size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                <p>Click "Gen Notes" on any lesson to generate grounded bilingual study notes.</p>
              </div>
            )
          ) : previewMCQs && previewMCQs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {previewMCQs.map((q, qIdx) => (
                <div
                  key={qIdx}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.25rem' }}>
                    Q{qIdx + 1}. {q.question_english}
                  </div>
                  {q.question_tamil && (
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.6rem' }}>
                      {q.question_tamil}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    {q.options.map((opt) => {
                      const isCorrect = opt.option_key === q.correct_option;
                      return (
                        <div
                          key={opt.option_key}
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            background: isCorrect ? 'rgba(52, 211, 153, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                            border: `1px solid ${isCorrect ? '#34d399' : 'rgba(148, 163, 184, 0.1)'}`,
                            fontSize: '0.78rem',
                            color: isCorrect ? '#34d399' : '#cbd5e1',
                          }}
                        >
                          <strong>{opt.option_key}.</strong> {opt.text_english}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                    <strong>Explanation:</strong> {q.explanation_english}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              <HelpCircle size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
              <p>Click "Gen MCQs" on any lesson to synthesize 5 exam-grade practice questions.</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(148, 163, 184, 0.15)', paddingTop: '1rem', marginTop: '0.5rem' }}>
        <button type="button" className="asw-btn-ghost" onClick={onBack}>
          Back to Alignment
        </button>
        <button type="button" className="asw-btn-primary" onClick={onNext}>
          Next: Review & Publish (Step 12) ➔
        </button>
      </div>
    </div>
  );
};
