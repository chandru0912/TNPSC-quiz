import React, { useState, useEffect, useMemo } from 'react';
import type { CanonicalUnitDraft, MatchedLessonDraft } from './types';
import {
  BookOpen,
  Calculator,
  Globe,
  BookMarked,
  CheckSquare,
  Square,
  Trash2,
  Tag,
  Plus,
  Search,
  Layers,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  CANONICAL_SUBJECTS,
  CANONICAL_OTHER_SUBJECT_UNITS,
  classifyUnitSubject,
  ensureAllCanonicalSubjectsFrontend,
} from './canonicalSubjectData';
import { apiFetch } from '../../../utils/api';
import { compareLessons } from '../../../utils/naturalSort';

interface PhaseBAlignmentProps {
  examId?: string;
  units: CanonicalUnitDraft[];
  setUnits: React.Dispatch<React.SetStateAction<CanonicalUnitDraft[]>>;
  selectedStandards?: number[];
  selectedTextbookIds?: number[];
  onNext: () => void;
  onBack: () => void;
}

export const PhaseBAlignment: React.FC<PhaseBAlignmentProps> = ({
  examId = 'group4',
  units,
  setUnits,
  selectedStandards = [6, 7, 8, 9, 10, 11, 12],
  onNext,
  onBack,
}) => {
  // 1. Subject Selection State
  const [activeSubject, setActiveSubject] = useState<string>('general-studies');
  const [activeUnitNumber, setActiveUnitNumber] = useState<number>(1);
  const [activeStandard, setActiveStandard] = useState<number>(6);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fetchingSubject, setFetchingSubject] = useState<boolean>(false);

  // Group units by subject_slug
  const unitsBySubject = useMemo(() => {
    const grouped: Record<string, CanonicalUnitDraft[]> = {
      'general-studies': [],
      aptitude: [],
      'general-english': [],
      'general-tamil': [],
    };

    for (const u of units) {
      const sub = classifyUnitSubject(u);
      if (!grouped[sub]) grouped[sub] = [];
      grouped[sub].push(u);
    }

    // Sort units by unit_number within each subject
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.unit_number - b.unit_number);
    }

    return grouped;
  }, [units]);

  // Ensure all 4 canonical subjects have their guaranteed parent units
  useEffect(() => {
    const currentGsUnits = unitsBySubject['general-studies'] || [];
    const currentMathUnits = unitsBySubject['aptitude'] || [];
    const currentEngUnits = unitsBySubject['general-english'] || [];
    const currentTamUnits = unitsBySubject['general-tamil'] || [];

    if (
      currentGsUnits.length !== 6 ||
      currentMathUnits.length < 2 ||
      currentEngUnits.length < 6 ||
      currentTamUnits.length < 7
    ) {
      setUnits((prev) => ensureAllCanonicalSubjectsFrontend(prev));
    }
  }, [unitsBySubject, setUnits]);

  // If active subject has 0 units or its units have 0 lessons, load canonical lessons
  useEffect(() => {
    const subjectUnits = unitsBySubject[activeSubject] || [];
    const hasAnyLessons = subjectUnits.some((u) => u.lessons && u.lessons.length > 0);

    if (subjectUnits.length === 0 || !hasAnyLessons) {
      const fetchCanonicalUnits = async () => {
        setFetchingSubject(true);
        try {
          const res = await apiFetch(
            `/api/study-management/ai-import/canonical-units?examId=${encodeURIComponent(
              examId
            )}&subjectId=${encodeURIComponent(activeSubject)}&standards=${selectedStandards.join(',')}`
          );
          const data = await res.json();
          if (res.ok && data.success && Array.isArray(data.units) && data.units.length > 0) {
            setUnits((prev) => {
              // Replace or supplement this subject's units
              const otherUnits = prev.filter((u) => classifyUnitSubject(u) !== activeSubject);
              return [...otherUnits, ...data.units];
            });
          } else {
            // Fallback to client-side default units if network call is empty
            if (activeSubject !== 'general-studies' && subjectUnits.length === 0) {
              const defaultDefs = CANONICAL_OTHER_SUBJECT_UNITS[activeSubject] || [];
              const fallbackUnits: CanonicalUnitDraft[] = defaultDefs.map((d) => ({
                unit_number: d.unit_number,
                unit_code: d.unit_code,
                title: d.title,
                description: d.description,
                subject_slug: activeSubject,
                subject_name: CANONICAL_SUBJECTS.find((s) => s.id === activeSubject)?.name || activeSubject,
                syllabus_topics: d.syllabus_topics,
                lessons: [],
                selected_for_publish: true,
              }));
              setUnits((prev) => [...prev, ...fallbackUnits]);
            }
          }
        } catch (err) {
          console.warn('[PhaseBAlignment] Could not fetch canonical units from API:', err);
        } finally {
          setFetchingSubject(false);
        }
      };

      fetchCanonicalUnits();
    }
  }, [activeSubject, examId, selectedStandards]);

  // Active Subject's Units
  const currentSubjectUnits = unitsBySubject[activeSubject] || [];

  // Active Unit within the active subject
  const currentUnit =
    currentSubjectUnits.find((u) => u.unit_number === activeUnitNumber) ||
    currentSubjectUnits[0] ||
    null;

  // Sync activeUnitNumber if currentUnit is out of bounds
  useEffect(() => {
    if (currentSubjectUnits.length > 0 && !currentSubjectUnits.some((u) => u.unit_number === activeUnitNumber)) {
      setActiveUnitNumber(currentSubjectUnits[0].unit_number);
    }
  }, [activeSubject, currentSubjectUnits, activeUnitNumber]);

  // Handlers for Unit and Lesson mutations
  const handleToggleUnitSelect = (subjectSlug: string, unitNumber: number) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (classifyUnitSubject(u) === subjectSlug && u.unit_number === unitNumber) {
          return {
            ...u,
            selected_for_publish: u.selected_for_publish !== false ? false : true,
          };
        }
        return u;
      })
    );
  };

  const handleToggleSubjectSelectAll = (subjectSlug: string, selectAll: boolean) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (classifyUnitSubject(u) === subjectSlug) {
          return {
            ...u,
            selected_for_publish: selectAll,
          };
        }
        return u;
      })
    );
  };

  const handleLessonSelectToggle = (unitNumber: number, lessonIndex: number) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (classifyUnitSubject(u) === activeSubject && u.unit_number === unitNumber) {
          const lessons = [...u.lessons];
          lessons[lessonIndex] = {
            ...lessons[lessonIndex],
            selected_for_publish: lessons[lessonIndex].selected_for_publish !== false ? false : true,
          };
          return { ...u, lessons };
        }
        return u;
      })
    );
  };

  const handleLessonTitleChange = (unitNumber: number, lessonIndex: number, newTitle: string) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (classifyUnitSubject(u) === activeSubject && u.unit_number === unitNumber) {
          const lessons = [...u.lessons];
          lessons[lessonIndex] = { ...lessons[lessonIndex], title: newTitle };
          return { ...u, lessons };
        }
        return u;
      })
    );
  };

  const handleRemoveLesson = (unitNumber: number, lessonIndex: number) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (classifyUnitSubject(u) === activeSubject && u.unit_number === unitNumber) {
          const lessons = u.lessons.filter((_, idx) => idx !== lessonIndex);
          return { ...u, lessons };
        }
        return u;
      })
    );
  };

  const handleAddLesson = (unitNumber: number, std: number) => {
    const title = prompt(`Enter lesson title for Class ${std}:`);
    if (!title || !title.trim()) return;

    setUnits((prev) =>
      prev.map((u) => {
        if (classifyUnitSubject(u) === activeSubject && u.unit_number === unitNumber) {
          const existingForStd = u.lessons.filter((l) => l.standard_number === std);
          const newLesson: MatchedLessonDraft = {
            id: `draft_${std}_${Date.now()}_u${unitNumber}_${activeSubject}`,
            unit_number: unitNumber,
            subject_slug: activeSubject,
            standard_number: std,
            term: 'Full Year',
            lesson_number: String(existingForStd.length + 1),
            title: title.trim(),
            textbook_title: `Samacheer Kalvi Class ${std}`,
            topics: [{ topic_name: `${title.trim()} - Key Concepts`, display_order: 1 }],
            selected_for_publish: true,
          };
          return {
            ...u,
            lessons: [...u.lessons, newLesson].sort(compareLessons),
          };
        }
        return u;
      })
    );
  };

  const handleAddTopicToLesson = (unitNumber: number, lessonIndex: number) => {
    const topicText = prompt('Enter new topic title:');
    if (!topicText || !topicText.trim()) return;

    setUnits((prev) =>
      prev.map((u) => {
        if (classifyUnitSubject(u) === activeSubject && u.unit_number === unitNumber) {
          const lessons = [...u.lessons];
          const topics = [
            ...(lessons[lessonIndex].topics || []),
            { topic_name: topicText.trim(), display_order: (lessons[lessonIndex].topics?.length || 0) + 1 },
          ];
          lessons[lessonIndex] = { ...lessons[lessonIndex], topics };
          return { ...u, lessons };
        }
        return u;
      })
    );
  };

  const handleRemoveTopic = (unitNumber: number, lessonIndex: number, topicIndex: number) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (classifyUnitSubject(u) === activeSubject && u.unit_number === unitNumber) {
          const lessons = [...u.lessons];
          const topics = lessons[lessonIndex].topics.filter((_, idx) => idx !== topicIndex);
          lessons[lessonIndex] = { ...lessons[lessonIndex], topics };
          return { ...u, lessons };
        }
        return u;
      })
    );
  };

  const handleAddNewUnitToSubject = () => {
    const unitTitle = prompt(`Enter title for new unit in ${activeSubject}:`);
    if (!unitTitle || !unitTitle.trim()) return;

    const nextUnitNum = (currentSubjectUnits.reduce((max, u) => Math.max(max, u.unit_number), 0) || 0) + 1;
    const newUnit: CanonicalUnitDraft = {
      unit_number: nextUnitNum,
      unit_code: `Unit ${nextUnitNum}`,
      title: unitTitle.trim(),
      subject_slug: activeSubject,
      subject_name: CANONICAL_SUBJECTS.find((s) => s.id === activeSubject)?.name || activeSubject,
      syllabus_topics: [`Introduction to ${unitTitle.trim()}`],
      lessons: [],
      selected_for_publish: true,
    };

    setUnits((prev) => [...prev, newUnit]);
    setActiveUnitNumber(nextUnitNum);
  };

  // Filter lessons strictly for the active standard, active unit and active subject
  const standardLessons = useMemo(() => {
    if (!currentUnit || !Array.isArray(currentUnit.lessons)) return [];
    let list = currentUnit.lessons.filter((l) => {
      const matchesStd = l.standard_number === activeStandard;
      const matchesUnit = l.unit_number === undefined || l.unit_number === currentUnit.unit_number;
      const matchesSubj = !l.subject_slug || l.subject_slug === activeSubject;
      return matchesStd && matchesUnit && matchesSubj;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.lesson_number.includes(q) ||
          (l.topics || []).some((t) => t.topic_name.toLowerCase().includes(q))
      );
    }
    return list.slice().sort(compareLessons);
  }, [currentUnit, activeStandard, searchQuery, activeSubject]);

  // Compute active subject stats
  const activeSubjectInfo = CANONICAL_SUBJECTS.find((s) => s.id === activeSubject) || CANONICAL_SUBJECTS[0];
  const activeSubjectSelectedCount = currentSubjectUnits.filter((u) => u.selected_for_publish !== false).length;
  const activeSubjectTotalLessons = currentSubjectUnits.reduce(
    (acc, u) => acc + (u.lessons?.filter((l) => l.selected_for_publish !== false).length || 0),
    0
  );

  // Independent Subject-Wise Validation Engine before Content Synthesis
  const validationReport = useMemo(() => {
    const errors: string[] = [];
    const info: string[] = [];

    // 1. General Studies verification (guaranteed 6 parent units)
    const gsUnits = unitsBySubject['general-studies'] || [];
    if (gsUnits.length < 6) {
      errors.push(`General Studies: Exactly 6 parent units required (currently ${gsUnits.length}).`);
    } else {
      info.push(`General Studies: 6 parent units verified.`);
    }

    // 2. General English verification (guaranteed 6 units)
    const engUnits = unitsBySubject['general-english'] || [];
    if (engUnits.length > 0 && engUnits.length < 6) {
      errors.push(`General English: 6 parent units required (Grammar to Literary Works; currently ${engUnits.length}).`);
    } else if (engUnits.length >= 6) {
      info.push(`General English: 6 parent units verified.`);
    }

    // 3. General Tamil verification (guaranteed 7 units)
    const tamUnits = unitsBySubject['general-tamil'] || [];
    if (tamUnits.length > 0 && tamUnits.length < 7) {
      errors.push(`General Tamil: 7 parent units required (இலக்கணம் முதல் இலக்கியம் வரை; currently ${tamUnits.length}).`);
    } else if (tamUnits.length >= 7) {
      info.push(`General Tamil: 7 parent units verified.`);
    }

    // 4. Aptitude verification (2 units)
    const aptUnits = unitsBySubject['aptitude'] || [];
    if (aptUnits.length > 0 && aptUnits.length < 2) {
      errors.push(`Aptitude: 2 units required (currently ${aptUnits.length}).`);
    } else if (aptUnits.length >= 2) {
      info.push(`Aptitude: 2 units verified.`);
    }

    // 5. Active Subject empty lesson check
    const emptyUnitsInActiveSubject = currentSubjectUnits.filter(
      (u) => u.selected_for_publish !== false && (!u.lessons || u.lessons.length === 0)
    );
    if (emptyUnitsInActiveSubject.length > 0) {
      errors.push(
        `${activeSubjectInfo.name}: ${emptyUnitsInActiveSubject.map((u) => u.unit_code).join(', ')} has 0 mapped textbook lessons.`
      );
    }

    // 6. Current Unit lesson validity check
    if (currentUnit) {
      const lessons = currentUnit.lessons || [];
      const invalidLessons = lessons.filter(
        (l) => !l.title || !l.title.trim() || !Array.isArray(l.topics) || l.topics.length === 0
      );
      if (invalidLessons.length > 0) {
        errors.push(`${currentUnit.unit_code} contains ${invalidLessons.length} lesson(s) with missing title or 0 topics.`);
      }
    }

    const isValid = errors.length === 0;
    return { isValid, errors, info };
  }, [unitsBySubject, currentSubjectUnits, activeSubjectInfo, currentUnit]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Hierarchy Breadcrumb Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.85rem',
          background: 'rgba(15, 23, 42, 0.65)',
          borderRadius: '8px',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          fontSize: '0.75rem',
          color: '#94a3b8',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ color: '#c084fc', fontWeight: 700 }}>Canonical Hierarchy:</span>
        <span>{examId.toUpperCase()}</span>
        <span>➔</span>
        <span style={{ color: activeSubjectInfo.color, fontWeight: 700 }}>{activeSubjectInfo.name}</span>
        <span>➔</span>
        <span>{currentUnit ? `${currentUnit.unit_code}: ${currentUnit.title}` : 'Parent Unit'}</span>
        <span>➔</span>
        <span style={{ color: '#38bdf8', fontWeight: 600 }}>Class {activeStandard}</span>
        <span>➔</span>
        <span style={{ color: '#fbbf24', fontWeight: 600 }}>Textbook Unit (இயல் / Unit)</span>
        <span>➔</span>
        <span>Lesson Number & Title</span>
        <span>➔</span>
        <span>Matched Topics & Syllabus Ref</span>
      </div>

      {/* 1. Add Subject Selection - Four Distinct Selectable Cards */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <label className="asw-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Layers size={14} style={{ color: '#818cf8' }} />
            <span>Select Target Subject (Steps 05–09 Alignment)</span>
          </label>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            4 Official TNPSC Subjects Available
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {CANONICAL_SUBJECTS.map((sub) => {
            const isActive = sub.id === activeSubject;
            const subUnits = unitsBySubject[sub.id] || [];
            const subSelectedUnits = subUnits.filter((u) => u.selected_for_publish !== false);
            const isAllSelected = subUnits.length > 0 && subSelectedUnits.length === subUnits.length;
            const isPartiallySelected = subSelectedUnits.length > 0 && !isAllSelected;
            const subLessonsCount = subUnits.reduce(
              (acc, u) => acc + (u.lessons?.filter((l) => l.selected_for_publish !== false).length || 0),
              0
            );

            // Icon selection
            const getIcon = () => {
              switch (sub.id) {
                case 'general-studies':
                  return <BookOpen size={18} style={{ color: sub.color }} />;
                case 'aptitude':
                  return <Calculator size={18} style={{ color: sub.color }} />;
                case 'general-english':
                  return <Globe size={18} style={{ color: sub.color }} />;
                case 'general-tamil':
                  return <BookMarked size={18} style={{ color: sub.color }} />;
                default:
                  return <BookOpen size={18} />;
              }
            };

            return (
              <div
                key={sub.id}
                onClick={() => {
                  setActiveSubject(sub.id);
                  const firstUnit = unitsBySubject[sub.id]?.[0];
                  if (firstUnit) {
                    setActiveUnitNumber(firstUnit.unit_number);
                  }
                }}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(30, 41, 59, 0.85)' : 'rgba(15, 23, 42, 0.65)',
                  border: `2px solid ${isActive ? sub.color : 'rgba(148, 163, 184, 0.15)'}`,
                  boxShadow: isActive ? `0 0 16px ${sub.color}33` : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {/* Header row: Checkbox + Icon + Name */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    {getIcon()}
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: isActive ? '#f8fafc' : '#cbd5e1',
                      }}
                    >
                      {sub.name}
                    </span>
                  </div>

                  {/* Subject Publish Selection Checkbox */}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSubjectSelectAll(sub.id, !isAllSelected);
                    }}
                    title={isAllSelected ? 'Deselect all units in this subject' : 'Select all units in this subject'}
                    style={{ cursor: 'pointer', color: isAllSelected ? '#34d399' : isPartiallySelected ? '#38bdf8' : '#64748b' }}
                  >
                    {isAllSelected ? (
                      <CheckSquare size={17} />
                    ) : isPartiallySelected ? (
                      <CheckSquare size={17} style={{ opacity: 0.6 }} />
                    ) : (
                      <Square size={17} />
                    )}
                  </span>
                </div>

                {/* Subtitle / Description */}
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.72rem',
                    color: '#94a3b8',
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {sub.description}
                </p>

                {/* Badges row: Unit count & Lesson count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      background: sub.badgeBg,
                      color: sub.color,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                    }}
                  >
                    {sub.id === 'general-studies'
                      ? '6 PARENT UNITS'
                      : `${subUnits.length} UNITS`}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      background: 'rgba(148, 163, 184, 0.15)',
                      color: '#cbd5e1',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                    }}
                  >
                    {subLessonsCount} Lessons Mapped
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2 & 3. Unit Selection Bar for Active Subject */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                background: activeSubjectInfo.badgeBg,
                color: activeSubjectInfo.color,
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
              }}
            >
              {activeSubjectInfo.code}
            </span>
            <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
              {activeSubjectInfo.name} Units ({activeSubjectSelectedCount} of {currentSubjectUnits.length} Selected • {activeSubjectTotalLessons} Lessons)
            </span>
            {fetchingSubject && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#38bdf8' }}>
                <Loader2 size={13} className="animate-spin" />
                <span>Loading units...</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="asw-btn-ghost sm"
              onClick={() => handleToggleSubjectSelectAll(activeSubject, true)}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', color: '#34d399' }}
            >
              Select All
            </button>
            <button
              type="button"
              className="asw-btn-ghost sm"
              onClick={() => handleToggleSubjectSelectAll(activeSubject, false)}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
            >
              Clear
            </button>
            <button
              type="button"
              className="asw-btn-ghost sm"
              onClick={handleAddNewUnitToSubject}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <Plus size={12} />
              <span>Add Unit</span>
            </button>
          </div>
        </div>

        {/* Units Tabs / Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.35rem' }}>
          {currentSubjectUnits.map((u) => {
            const isSelected = u.selected_for_publish !== false;
            const isActive = u.unit_number === activeUnitNumber;
            const mappedCount = u.lessons?.filter((l) => l.selected_for_publish !== false).length || 0;

            return (
              <div
                key={u.unit_number}
                onClick={() => setActiveUnitNumber(u.unit_number)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.8rem',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(99, 102, 241, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                  border: `1px solid ${isActive ? '#6366f1' : 'rgba(148, 163, 184, 0.15)'}`,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleUnitSelect(activeSubject, u.unit_number);
                  }}
                  style={{ color: isSelected ? '#34d399' : '#64748b' }}
                >
                  {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                </span>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: isActive ? '#f8fafc' : '#cbd5e1' }}>
                  {u.unit_code}: {u.title}
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    background: 'rgba(148, 163, 184, 0.2)',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    color: mappedCount > 0 ? '#38bdf8' : '#94a3b8',
                  }}
                >
                  {mappedCount}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Active Parent Unit Container with Standard Tabs Nested Inside */}
      {currentUnit && (
        <div className="asw-unit-card" style={{ border: `1px solid ${activeSubjectInfo.color}44` }}>
          <div className="asw-unit-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    background: '#4f46e5',
                    color: '#fff',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  SINGLE PARENT CONTAINER
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    background: activeSubjectInfo.badgeBg,
                    color: activeSubjectInfo.color,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                  }}
                >
                  {activeSubjectInfo.name}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#f8fafc' }}>
                  {currentUnit.unit_code} – {currentUnit.title}
                </h3>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.4 }}>
                <strong style={{ color: '#cbd5e1' }}>Official Syllabus Topics: </strong>
                {currentUnit.syllabus_topics.slice(0, 5).join(', ')}
                {currentUnit.syllabus_topics.length > 5 && ` +${currentUnit.syllabus_topics.length - 5} more`}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 700 }}>
                {currentUnit.lessons.length} Lessons Mapped
              </div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Across Classes 6th–12th</span>
            </div>
          </div>

          {/* Standard Tabs (6th to 12th) INSIDE the Single Parent Unit */}
          <div className="asw-standard-tabs">
            {[6, 7, 8, 9, 10, 11, 12].map((std) => {
              const count = currentUnit.lessons.filter((l) => l.standard_number === std).length;
              return (
                <button
                  key={std}
                  type="button"
                  className={`asw-std-tab ${activeStandard === std ? 'active' : ''}`}
                  onClick={() => setActiveStandard(std)}
                >
                  Class {std} ({count})
                </button>
              );
            })}
          </div>

          {/* Search & Actions Bar for this standard */}
          <div
            style={{
              padding: '0.75rem 1rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
                Class {activeStandard} Mapped Lessons ({standardLessons.length})
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                (Strict standard isolation — authentic Samacheer Kalvi content)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                }}
              >
                <Search size={13} style={{ color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter lessons..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f8fafc',
                    fontSize: '0.78rem',
                    outline: 'none',
                    width: '120px',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => handleAddLesson(currentUnit.unit_number, activeStandard)}
                className="asw-btn-ghost sm"
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.65rem',
                  color: '#818cf8',
                  borderColor: 'rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Plus size={13} />
                <span>Add Lesson</span>
              </button>
            </div>
          </div>

          {/* Mapped Lessons List with custom scroll container */}
          <div
            style={{
              padding: '0.5rem 1rem 1rem',
              maxHeight: '440px',
              overflowY: 'auto',
            }}
          >
            {standardLessons.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2.5rem 1rem',
                  color: '#94a3b8',
                  fontSize: '0.85rem',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: '8px',
                  border: '1px dashed rgba(148, 163, 184, 0.2)',
                }}
              >
                <p style={{ margin: '0 0 0.5rem' }}>
                  No textbook chapters from Class {activeStandard} mapped to {currentUnit.unit_code} yet.
                </p>
                <button
                  type="button"
                  onClick={() => handleAddLesson(currentUnit.unit_number, activeStandard)}
                  className="asw-btn-ghost sm"
                  style={{ color: '#818cf8', borderColor: 'rgba(99, 102, 241, 0.4)', marginTop: '0.5rem' }}
                >
                  + Add Lesson for Class {activeStandard}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {standardLessons.map((l) => {
                  const globalLessonIdx = currentUnit.lessons.indexOf(l);
                  const isLessonSelected = l.selected_for_publish !== false;

                  return (
                    <div
                      key={l.id || `${l.standard_number}_${l.lesson_number}_${l.title}`}
                      style={{
                        background: isLessonSelected ? 'rgba(15, 23, 42, 0.75)' : 'rgba(15, 23, 42, 0.35)',
                        border: `1px solid ${isLessonSelected ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.1)'}`,
                        borderRadius: '8px',
                        padding: '0.85rem 1rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Lesson Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                          {/* Lesson Selection Checkbox */}
                          <span
                            onClick={() => handleLessonSelectToggle(currentUnit.unit_number, globalLessonIdx)}
                            title={isLessonSelected ? 'Exclude lesson from publish' : 'Include lesson for publish'}
                            style={{ cursor: 'pointer', color: isLessonSelected ? '#34d399' : '#64748b' }}
                          >
                            {isLessonSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          </span>

                          <span
                            style={{
                              fontSize: '0.7rem',
                              background: 'rgba(251, 191, 36, 0.18)',
                              color: '#fbbf24',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {l.textbook_unit_title ||
                              (activeSubject === 'general-tamil'
                                ? `இயல் ${String(l.lesson_number || '1.1').split('.')[0]}`
                                : `Textbook Unit ${String(l.lesson_number || '1.1').split('.')[0]}`)}
                          </span>

                          <span
                            style={{
                              fontSize: '0.72rem',
                              background: '#0284c7',
                              color: '#fff',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Lesson {l.lesson_number}
                          </span>

                          <input
                            type="text"
                            value={l.title}
                            onChange={(e) =>
                              handleLessonTitleChange(currentUnit.unit_number, globalLessonIdx, e.target.value)
                            }
                            style={{
                              background: 'transparent',
                              border: 'none',
                              borderBottom: '1px dashed rgba(148, 163, 184, 0.3)',
                              color: isLessonSelected ? '#f8fafc' : '#94a3b8',
                              fontSize: '0.9rem',
                              fontWeight: 600,
                              flex: 1,
                              padding: '0.2rem',
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '0.7rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            {l.mapping_status || 'FULLY MAPPED'} • {l.verification_status || 'VERIFIED'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {l.term} • {l.textbook_title || 'Samacheer Kalvi'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLesson(currentUnit.unit_number, globalLessonIdx)}
                            className="asw-btn-ghost"
                            style={{ padding: '0.2rem 0.45rem', color: '#ef4444' }}
                            title="Remove lesson"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* TNPSC Syllabus Reference Traceability Row */}
                      <div style={{ fontSize: '0.72rem', color: '#a5b4fc', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <strong style={{ color: '#818cf8' }}>TNPSC Syllabus Reference:</strong>
                        <span>{l.syllabus_reference || `${currentUnit.unit_code}: ${currentUnit.syllabus_topics[0] || currentUnit.title}`}</span>
                      </div>

                      {/* Topic Verification Chips (Step 09) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          flexWrap: 'wrap',
                          marginTop: '0.5rem',
                          paddingTop: '0.4rem',
                          borderTop: '1px solid rgba(148, 163, 184, 0.08)',
                        }}
                      >
                        <Tag size={11} style={{ color: '#06b6d4' }} />
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>09. Topics:</span>
                        {(l.topics || []).map((t, tIdx) => (
                          <span
                            key={tIdx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              background: 'rgba(30, 41, 59, 0.85)',
                              border: '1px solid rgba(148, 163, 184, 0.2)',
                              borderRadius: '4px',
                              padding: '0.12rem 0.45rem',
                              fontSize: '0.7rem',
                              color: '#cbd5e1',
                            }}
                          >
                            {t.topic_name}
                            <span
                              onClick={() => handleRemoveTopic(currentUnit.unit_number, globalLessonIdx, tIdx)}
                              style={{ cursor: 'pointer', color: '#94a3b8', marginLeft: '2px', fontWeight: 700 }}
                              title="Delete topic"
                            >
                              ×
                            </span>
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddTopicToLesson(currentUnit.unit_number, globalLessonIdx)}
                          style={{
                            background: 'transparent',
                            border: '1px dashed rgba(99, 102, 241, 0.5)',
                            borderRadius: '4px',
                            color: '#818cf8',
                            fontSize: '0.7rem',
                            padding: '0.12rem 0.45rem',
                            cursor: 'pointer',
                          }}
                        >
                          + Add Topic
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pre-Synthesis Validation Status Banner */}
      <div
        style={{
          borderRadius: '8px',
          padding: '0.85rem 1.15rem',
          background: validationReport.isValid ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
          border: `1px solid ${validationReport.isValid ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            {validationReport.isValid ? (
              <CheckCircle2 size={16} style={{ color: '#10b981' }} />
            ) : (
              <AlertCircle size={16} style={{ color: '#ef4444' }} />
            )}
            <span
              style={{
                fontWeight: 700,
                fontSize: '0.82rem',
                color: validationReport.isValid ? '#34d399' : '#f87171',
              }}
            >
              {validationReport.isValid
                ? 'Syllabus Alignment & Hierarchy Verified Across Subjects'
                : 'Validation Gate: Resolution Required Before Synthesis'}
            </span>
          </div>

          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            {validationReport.isValid
              ? `${activeSubjectInfo.name} (${currentSubjectUnits.length} Units Ready)`
              : `${validationReport.errors.length} Issue(s) Blocking Advancement`}
          </span>
        </div>

        {validationReport.isValid ? (
          <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            All required units, standard mappings (Classes 6–12), lessons, and topics are verified without leaks or collisions.
          </div>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.74rem', color: '#fca5a5', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {validationReport.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation Buttons */}
      <div
        className="asw-modal-footer"
        style={{
          margin: '0 -1.75rem -1.5rem',
          borderTop: '1px solid rgba(148, 163, 184, 0.15)',
        }}
      >
        <button type="button" className="asw-btn-ghost" onClick={onBack}>
          Back to Setup
        </button>
        <button
          type="button"
          className="asw-btn-primary"
          onClick={onNext}
          disabled={!validationReport.isValid}
          style={{
            opacity: validationReport.isValid ? 1 : 0.5,
            cursor: validationReport.isValid ? 'pointer' : 'not-allowed',
          }}
          title={!validationReport.isValid ? 'Resolve all validation issues above to proceed to Step 10 & 11' : undefined}
        >
          Next: Generate Notes & MCQs (Steps 10–11) ➔
        </button>
      </div>
    </div>
  );
};
