import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw,
  Pause,
  Play,
  ArrowRight,
} from 'lucide-react';
import type { RepoTextbook, SyllabusImportJobSnapshot } from './types';
import { apiFetch } from '../../../utils/api';

interface PhaseASetupProps {
  examId: string;
  setExamId: (id: string) => void;
  targetSubject?: string;
  setTargetSubject?: (subj: string) => void;
  rawText: string;
  setRawText: (text: string) => void;
  selectedStandards?: number[];
  setSelectedStandards?: (standards: number[]) => void;
  selectedTextbookIds: number[];
  setSelectedTextbookIds: (ids: number[]) => void;
  activeJobId?: string | null;
  setActiveJobId?: (id: string | null) => void;
  onAnalyzeComplete: (units: any[]) => void;
}

const CANONICAL_EXAMS = [
  { id: 'group1', name: 'TNPSC Group 1' },
  { id: 'group2', name: 'TNPSC Group 2 & 2A' },
  { id: 'group4', name: 'TNPSC Group 4' },
];

function formatJobErrorMessage(status: number | null, message: string | null, errorType: string | null): string {
  if (status === 503) {
    return 'Gemini service temporarily overloaded (503). Automatic retry with fallback models was attempted.';
  }
  if (status === 429) {
    return 'Google Gemini rate limit or quota exceeded (429). Please wait a moment before retrying.';
  }
  if (status === 401 || status === 403) {
    return 'Gemini authentication error (401/403). Please verify your GEMINI_API_KEY in the Admin Panel or environment.';
  }
  if (status === 504) {
    return 'Processing timeout (504). Gemini took too long to respond. Please try retrying failed stages.';
  }
  if (status === 422 || errorType === 'invalid_json_syntax') {
    return `JSON parsing error: ${message || 'Invalid structured output returned by AI.'}`;
  }
  return message || 'Syllabus analysis failed.';
}

export const PhaseASetup: React.FC<PhaseASetupProps> = ({
  examId,
  setExamId,
  targetSubject: propTargetSubject = 'all',
  setTargetSubject: setPropTargetSubject,
  rawText,
  setRawText,
  selectedStandards: propStandards,
  setSelectedStandards: setPropStandards,
  selectedTextbookIds,
  setSelectedTextbookIds,
  activeJobId = null,
  setActiveJobId,
  onAnalyzeComplete,
}) => {
  const [internalTargetSubject, setInternalTargetSubject] = useState<string>('all');
  const currentTargetSubject = propTargetSubject || internalTargetSubject;
  const updateTargetSubject = (subj: string) => {
    if (setPropTargetSubject) setPropTargetSubject(subj);
    setInternalTargetSubject(subj);
  };

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [availableTextbooks, setAvailableTextbooks] = useState<RepoTextbook[]>([]);
  const [loadingTextbooks, setLoadingTextbooks] = useState<boolean>(false);
  const [internalStandards, setInternalStandards] = useState<number[]>([6, 7, 8, 9, 10, 11, 12]);
  const activeStandards = propStandards && propStandards.length > 0 ? propStandards : internalStandards;

  // Filter textbooks displayed and auto-selected when targetSubject is specified
  const filteredAvailableTextbooks = useMemo(() => {
    if (currentTargetSubject === 'general-tamil') {
      return availableTextbooks.filter((tb) => {
        const s = `${tb.subject} ${tb.file_name}`.toLowerCase();
        return tb.subject === 'Tamil' || (s.includes('tamil') && !s.includes('science') && !s.includes('social'));
      });
    }
    if (currentTargetSubject === 'general-english') {
      return availableTextbooks.filter((tb) => {
        const s = `${tb.subject} ${tb.file_name}`.toLowerCase();
        return tb.subject === 'English' || s.includes('english');
      });
    }
    if (currentTargetSubject === 'aptitude') {
      return availableTextbooks.filter((tb) => {
        const s = `${tb.subject} ${tb.file_name}`.toLowerCase();
        return tb.subject.toLowerCase().includes('math') || s.includes('math') || s.includes('கணிதம்');
      });
    }
    if (currentTargetSubject === 'general-studies') {
      return availableTextbooks.filter((tb) => {
        return tb.subject !== 'Tamil' && tb.subject !== 'English';
      });
    }
    return availableTextbooks;
  }, [availableTextbooks, currentTargetSubject]);

  const updateStandards = (stds: number[]) => {
    if (setPropStandards) setPropStandards(stds);
    setInternalStandards(stds);
  };
  const [jobSnapshot, setJobSnapshot] = useState<SyllabusImportJobSnapshot | null>(null);
  const [controlLoading, setControlLoading] = useState<boolean>(false);

  const shouldAutoAdvanceRef = useRef<boolean>(false);

  // Load available textbooks from PostgreSQL
  useEffect(() => {
    const fetchTextbooks = async () => {
      setLoadingTextbooks(true);
      try {
        const res = await apiFetch('/api/drive/materials?limit=200');
        const data = await res.json();
        const rawMaterials = Array.isArray(data.data) ? data.data : (Array.isArray(data.materials) ? data.materials : []);
        if (rawMaterials.length > 0) {
          const list: RepoTextbook[] = rawMaterials.map((m: any) => ({
            id: m.id,
            standard: Number(m.standard) || 10,
            subject: m.subject || 'General Studies',
            term: m.term || 'Full Year',
            file_name: m.file_name || 'Textbook',
            google_drive_file_id: m.google_drive_file_id || '',
            has_toc: Boolean(m.extracted_toc),
          }));
          setAvailableTextbooks(list);

          // Auto-select textbooks for the checked standards if nothing is selected yet
          if (selectedTextbookIds.length === 0) {
            const defaultSelected = list
              .filter((tb) => {
                if (!activeStandards.includes(tb.standard)) return false;
                if (currentTargetSubject === 'general-tamil') {
                  const s = `${tb.subject} ${tb.file_name}`.toLowerCase();
                  return tb.subject === 'Tamil' || (s.includes('tamil') && !s.includes('science') && !s.includes('social'));
                }
                return true;
              })
              .map((tb) => tb.id);
            setSelectedTextbookIds(defaultSelected);
          }
        }
      } catch (err) {
        console.error('Failed to load textbooks', err);
      } finally {
        setLoadingTextbooks(false);
      }
    };
    fetchTextbooks();
  }, []);

  // Poll active background job status cleanly (short 15s per-poll request, zero 30s hang)
  useEffect(() => {
    if (!activeJobId) {
      return;
    }

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const pollStatus = async () => {
      try {
        const res = await apiFetch(`/api/study-management/ai-import/jobs/${encodeURIComponent(activeJobId)}`, {
          timeoutMs: 15000,
        });
        if (cancelled) return;

        if (res.status === 404) {
          setActiveJobId?.(null);
          setAnalyzing(false);
          return;
        }

        const data = await res.json();
        if (!res.ok || !data.success || !data.job) {
          throw new Error(data.message || 'Failed to poll job status.');
        }

        const job: SyllabusImportJobSnapshot = data.job;
        setJobSnapshot(job);

        const isActive = job.status === 'queued' || job.status === 'analyzing' || job.status === 'matching';
        setAnalyzing(isActive);

        if (job.status === 'failed') {
          setErrorStatus(job.errorStatus || 500);
          setErrorMsg(formatJobErrorMessage(job.errorStatus, job.errorMessage, job.errorType));
          shouldAutoAdvanceRef.current = false;
          return;
        }

        if (job.status === 'completed_with_errors') {
          setErrorStatus(null);
          setErrorMsg(job.errorMessage || `${job.failedTextbooks} textbook batch(es) encountered errors.`);
          shouldAutoAdvanceRef.current = false;
          return;
        }

        if (job.status === 'completed') {
          setErrorMsg(null);
          setErrorStatus(null);
          if (shouldAutoAdvanceRef.current && Array.isArray(job.units) && job.units.length > 0) {
            shouldAutoAdvanceRef.current = false;
            onAnalyzeComplete(job.units);
          }
          return;
        }

        if (job.status === 'paused') {
          return;
        }

        if (isActive && !cancelled) {
          timerId = setTimeout(pollStatus, 1200);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.warn('[PhaseASetup] Polling notice:', err?.message);
        timerId = setTimeout(pollStatus, 2000);
      }
    };

    pollStatus();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [activeJobId]);

  const handleStandardToggle = (std: number) => {
    let newStds: number[];
    if (activeStandards.includes(std)) {
      newStds = activeStandards.filter((s) => s !== std);
    } else {
      newStds = [...activeStandards, std].sort((a, b) => a - b);
    }
    updateStandards(newStds);

    const matchingIds = availableTextbooks
      .filter((tb) => newStds.includes(tb.standard))
      .map((tb) => tb.id);
    setSelectedTextbookIds(matchingIds);
  };

  const handleSelectAllStandards = () => {
    const all = [6, 7, 8, 9, 10, 11, 12];
    updateStandards(all);
    setSelectedTextbookIds(availableTextbooks.map((tb) => tb.id));
  };

  const handleClearStandards = () => {
    updateStandards([]);
    setSelectedTextbookIds([]);
  };

  const handleAnalyzeAndMatch = async () => {
    if (!rawText.trim()) {
      setErrorMsg('Please paste or upload the official TNPSC syllabus text.');
      setErrorStatus(400);
      return;
    }

    setAnalyzing(true);
    setErrorMsg(null);
    setErrorStatus(null);
    shouldAutoAdvanceRef.current = true;

    try {
      const resStart = await apiFetch('/api/study-management/ai-import/jobs/start', {
        method: 'POST',
        timeoutMs: 15000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId,
          rawText,
          textbookIds: selectedTextbookIds,
          selectedStandards: activeStandards,
          batchSize: 5,
          targetSubject: currentTargetSubject !== 'all' ? currentTargetSubject : undefined,
        }),
      });
      const dataStart = await resStart.json();

      if (!resStart.ok || !dataStart.success || !dataStart.job) {
        const status = dataStart.statusCode || resStart.status || 500;
        setErrorStatus(status);
        throw new Error(formatJobErrorMessage(status, dataStart.message, dataStart.errorType));
      }

      setJobSnapshot(dataStart.job);
      setActiveJobId?.(dataStart.job.id);
    } catch (err: any) {
      shouldAutoAdvanceRef.current = false;
      setAnalyzing(false);
      setErrorMsg(err.message || 'Network error starting background syllabus analysis.');
    }
  };

  const handleJobControl = async (action: 'pause' | 'resume' | 'retry-failed') => {
    if (!jobSnapshot?.id) return;
    setControlLoading(true);
    setErrorMsg(null);
    setErrorStatus(null);

    if (action === 'resume' || action === 'retry-failed') {
      shouldAutoAdvanceRef.current = true;
    } else {
      shouldAutoAdvanceRef.current = false;
    }

    try {
      const res = await apiFetch(
        `/api/study-management/ai-import/jobs/${encodeURIComponent(jobSnapshot.id)}/${action}`,
        { method: 'POST', timeoutMs: 15000 }
      );
      const data = await res.json();
      if (!res.ok || !data.success || !data.job) {
        throw new Error(data.message || `Failed to ${action} job.`);
      }
      setJobSnapshot(data.job);
      const isActive =
        data.job.status === 'queued' || data.job.status === 'analyzing' || data.job.status === 'matching';
      setAnalyzing(isActive);
      if (isActive) {
        setActiveJobId?.(null);
        setTimeout(() => setActiveJobId?.(data.job.id), 10);
      }
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to ${action} job.`);
    } finally {
      setControlLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Initial Selection Form Grid */}
      <div className="asw-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        <div className="asw-field-group">
          <label className="asw-label">01. Target TNPSC Examination</label>
          <select
            className="asw-select"
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
          >
            {CANONICAL_EXAMS.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        {/* 02. Target Subject / Paper */}
        <div className="asw-field-group">
          <label className="asw-label">02. Target Subject / Paper</label>
          <select
            className="asw-select"
            value={currentTargetSubject}
            onChange={(e) => updateTargetSubject(e.target.value)}
          >
            <option value="all">All 4 Subjects (Auto-detect or Combined Syllabus)</option>
            <option value="general-studies">General Studies (6 Parent Units)</option>
            <option value="aptitude">Aptitude and Mental Ability (2 Units)</option>
            <option value="general-english">General English (6 Units: Grammar to Literary)</option>
            <option value="general-tamil">General Tamil (7 Units: இலக்கணம் முதல் இலக்கியம் வரை)</option>
          </select>
        </div>

        {/* Standard Selector */}
        <div className="asw-field-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className="asw-label">03. Standard / Class Scope</label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className="asw-btn-ghost"
                style={{ padding: '0.15rem 0.45rem', fontSize: '0.68rem', color: '#818cf8' }}
                onClick={handleSelectAllStandards}
              >
                All (6–12)
              </button>
              <button
                type="button"
                className="asw-btn-ghost"
                style={{ padding: '0.15rem 0.45rem', fontSize: '0.68rem' }}
                onClick={handleClearStandards}
              >
                Clear
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {[6, 7, 8, 9, 10, 11, 12].map((std) => {
              const tbCount = availableTextbooks.filter((tb) => tb.standard === std).length;
              return (
                <button
                  key={std}
                  type="button"
                  onClick={() => handleStandardToggle(std)}
                  className={`asw-std-tab ${activeStandards.includes(std) ? 'active' : ''}`}
                  title={`Class ${std}: ${tbCount > 0 ? `${tbCount} Textbooks` : 'Higher Sec Canonical'}`}
                >
                  Class {std} <span style={{ opacity: 0.75, fontSize: '0.68rem' }}>({tbCount > 0 ? tbCount : 'Canon'})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TNPSC Syllabus Section */}
      <div className="asw-field-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label className="asw-label" style={{ margin: 0 }}>TNPSC SYLLABUS (Document Management & Official Text)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="asw-btn-ghost"
              style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', color: '#818cf8' }}
              onClick={() => {
                updateTargetSubject('general-studies');
                setRawText(`UNIT-I: GENERAL SCIENCE
(i) Scientific Knowledge and Scientific Temper - Power of Reasoning - Rote Learning vs Conceptual Learning - Science as a tool to understand the past, present and future.
(ii) Nature of Universe - General Scientific Laws – Mechanics - Properties of Matter, Force, Motion and Energy - Everyday application of the basic principles of Mechanics, Electricity and Magnetism, Light, Sound, Heat, Nuclear Physics, Laser, Electronics and Communications.
(iii) Elements and Compounds, Acids, Bases, Salts, Petroleum Products, Fertilizers, Pesticides.
(iv) Main concepts of Life Science, Classification of Living Organisms, Evolution, Genetics, Physiology, Nutrition, Health and Hygiene, Human diseases.
(v) Environment and Ecology.

UNIT-II: GEOGRAPHY OF INDIA
(i) Location – Physical features – Monsoon, rainfall, weather and climate – Water resources – Rivers in India – Soil, minerals and natural resources – Forest and wildlife.
(ii) Agricultural pattern - Transport - Communication - Population density and distribution - Disaster Management.

UNIT-III: HISTORY AND CULTURE OF INDIA
(i) Indus valley civilization - Guptas, Delhi Sultans, Mughals and Marathas - Age of Vijayanagaram and Bahmani Kingdoms - South Indian history.
(ii) Change and Continuity in the Socio - Cultural History of India - Characteristics of Indian culture, Unity in diversity.

UNIT-IV: INDIAN POLITY
(i) Constitution of India - Preamble to the Constitution - Salient features of the Constitution - Union, State and Union Territory.
(ii) Citizenship, Fundamental rights, Fundamental duties, Directive Principles of State Policy.
(iii) Union Executive, Union Legislature – State Executive, State Legislature – Local Governments, Panchayat Raj.
(iv) Judiciary in India – Rule of Law - Anti-corruption measures - Lokpal and Lok Ayukta - Right to Information.

UNIT-V: INDIAN ECONOMY
(i) Nature of Indian economy – Five year plan models - an assessment – Planning Commission and Niti Ayog.
(ii) Sources of revenue – Reserve Bank of India – Fiscal Policy and Monetary Policy – Finance Commission – Goods and Services Tax.
(iii) Structure of Indian Economy and Employment Generation, Land reforms and Agriculture, Application of Science and Technology in agriculture, Industrial growth.

UNIT-VI: INDIAN NATIONAL MOVEMENT & TAMIL HERITAGE
(i) National Renaissance – Early uprising against British rule – Indian National Congress – Emergence of leaders.
(ii) Different modes of Agitation: Growth of Satyagraha and Militant movements - Communalism and partition.
(iii) History of Tamil Society, related Archaeological discoveries, Tamil Literature from Sangam age till contemporary times.
(iv) Thirukkural: Significance as a Secular literature, Relevance to Everyday Life, Impact of Thirukkural on Humanity.`);
                setErrorMsg(null);
              }}
              title="Insert official 6-unit General Studies syllabus"
            >
              <Sparkles size={11} style={{ display: 'inline', marginRight: '3px' }} />
              Sample GS (6 Units)
            </button>

            <button
              type="button"
              className="asw-btn-ghost"
              style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', color: '#38bdf8' }}
              onClick={() => {
                updateTargetSubject('aptitude');
                setRawText(`UNIT-I: NUMERICAL ABILITY & SIMPLIFICATION
(i) Simplification and Order of Operations - Percentage - Highest Common Factor (HCF) & Lowest Common Multiple (LCM).
(ii) Ratio and Proportion - Simple and Compound Interest - Time and Work, Pipes and Cisterns.

UNIT-II: LOGICAL REASONING & MENTAL ABILITY
(i) Area, Perimeter and Volume (Mensuration 2D and 3D).
(ii) Logical Reasoning and Analytical Puzzles - Dice, Visual Reasoning and Alpha-numeric Series.
(iii) Number Series and Pattern Recognition - Data Interpretation and Graphical Representation.`);
                setErrorMsg(null);
              }}
              title="Insert official 2-unit Aptitude & Mental Ability syllabus"
            >
              <Sparkles size={11} style={{ display: 'inline', marginRight: '3px' }} />
              Sample Aptitude (2 Units)
            </button>

            <button
              type="button"
              className="asw-btn-ghost"
              style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', color: '#34d399' }}
              onClick={() => {
                updateTargetSubject('general-english');
                setRawText(`UNIT-I: GRAMMAR
(i) Parts of Speech - Nouns, Pronouns, Adjectives, Verbs, Adverbs, Prepositions, Conjunctions.
(ii) Subject-Verb Agreement (Concord) and Tenses and Aspects.
(iii) Active and Passive Voice, Sentence Patterns (SVO, SVIODO, SVOC).
(iv) Question Tags, Degrees of Comparison, Simple, Compound and Complex Sentences, Reported Speech.

UNIT-II: VOCABULARY
(i) Synonyms and Antonyms, Homophones and Homonyms.
(ii) Idioms and Phrases, Phrasal Verbs, Collocations.
(iii) Prefixes, Suffixes, Compound Words and Blended Words.
(iv) British English vs American English.

UNIT-III: WRITING SKILLS
(i) Formal and Informal Letter Writing.
(ii) Jumbled Sentences and Paragraph Coherence.
(iii) Sentence Sequence Order and Making Queries.
(iv) Note-Making and Summary Writing (Précis Writing).

UNIT-IV: TECHNICAL TERMS
(i) Administrative and Departmental Terminology.
(ii) Official Secretariat Glossary and Public Administration Vocabulary.
(iii) Judicial, Legal, Financial and Commercial Terms.
(iv) E-Governance and Technical Acronyms.

UNIT-V: READING COMPREHENSION
(i) Factual and Expository Passages Comprehension.
(ii) Editorial and Discursive Passages Analysis.
(iii) Tone Identification, Inferences and Fact Ascertainment.

UNIT-VI: TRANSLATION & LITERARY WORKS
(i) Bilingual Translation from English to Tamil and Tamil to English.
(ii) Grammatical Shift Patterns in Translation.
(iii) Prescribed Poems and Prose Works from Samacheer Kalvi School Textbooks.
(iv) Figures of Speech (Metaphor, Simile, Personification, Oxymoron).`);
                setErrorMsg(null);
              }}
              title="Insert official 6-unit General English syllabus (Units 1 to 6)"
            >
              <Sparkles size={11} style={{ display: 'inline', marginRight: '3px' }} />
              Sample English (6 Units)
            </button>

            <button
              type="button"
              className="asw-btn-ghost"
              style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', color: '#fbbf24' }}
              onClick={() => {
                updateTargetSubject('general-tamil');
                setRawText(`அலகு I: இலக்கணம் (25 கேள்விகள்)
எழுத்து: பிரித்து எழுதுதல் – சேர்த்து எழுதுதல் – சந்திப்பிழை – குறில், நெடில் வேறுபாடு – லகர, ளகர, ழகர வேறுபாடு – னகர, ணகர வேறுபாடு – ரகர, றகர வேறுபாடு – இனவெழுத்துகள் அறிதல் – சுட்டு எழுத்துகள் – வினா எழுத்துகள் – ஒருமைப் பன்மை அறிதல்.
சொல்: வேர்ச்சொல் அறிதல் – வேர்ச்சொல்லில் இருந்து வினைமுற்று, வினையெச்சம், வினையாலணையும் பெயர், பெயரெச்சம் வகை அறிதல் – அயற்சொல் – தமிழ்ச்சொல், எதிர்ச்சொல் – வினைச்சொல் – எழுத்துப் பிழை, ஒற்றுப்பிழை அறிதல் – இரண்டு வினைச் சொற்களின் வேறுபாடு அறிதல்.

அலகு II: சொல்லகராதி
(i) அகரவரிசைப்படுத்துதல், எதிர்ச்சொல் அறிதல் மற்றும் ஒருபொருள் குறித்த பலசொற்கள்.
(ii) மரபுத் தொடர்கள், பழமொழிகள் மற்றும் சொற்றொடர் அமைப்பு.
(iii) இலக்கிய வகைச் சொற்கள் (இயற்சொல், திரிசொல், திசைச்சொல், வடசொல்).
(iv) இணைச் சொற்கள், குறுக்கங்கள் மற்றும் மயங்கொலி வேறுபாடுகள்.

அலகு III: எழுதும் திறன்
(i) கடிதம் எழுதுதல் (அலுவல் முறை மற்றும் விண்ணப்பக் கடிதங்கள்).
(ii) பத்தி சுருக்குதல் (Note-making & Summary / Précis Writing).
(iii) பத்தி அமைத்தல், கருத்து ஒருமைப்பாடு மற்றும் தொடர் ஒழுங்கு.
(iv) விண்ணப்பப் படிவங்கள் மற்றும் மனுக்கள் தயாரிக்கும் முறை.

அலகு IV: கலைச் சொற்கள்
(i) அலுவலக மற்றும் தலைமைச் செயலகக் கலைச்சொற்கள்.
(ii) நீதிமன்றம், சட்டம் மற்றும் நிருவாகச் சொற்களஞ்சியம்.
(iii) அறிவியல் மற்றும் கணினித் தமிழ்க் கலைச்சொற்கள்.
(iv) வணிகவியல், நிதி மற்றும் வங்கித் துறை கலைச்சொற்கள்.

அலகு V: வாசித்தல் – புரிந்து கொள்ளும் திறன்
(i) பத்தியைப் படித்து வினாக்களுக்கு விடையளித்தல்.
(ii) கருத்துணர்தல் மற்றும் மையக்கருத்தைக் கண்டறிதல்.
(iii) உரைநடைப் பத்தி பகுப்பாய்வு மற்றும் ஆசிரியர் நோக்கம்.
(iv) தகவல்களைத் திரட்டுதல் மற்றும் தர்க்கரீதியான முடிவெடுத்தல்.

அலகு VI: எளிய மொழிபெயர்ப்பு
(i) ஆங்கிலத்திலிருந்து தமிழாக்கம் செய்தல்.
(ii) தமிழிலிருந்து ஆங்கிலத்தில் மொழிபெயர்த்தல்.
(iii) அலுவல் கடிதங்கள் மற்றும் சுற்றறிக்கைகள் மொழிபெயர்ப்பு.
(iv) மொழிபெயர்ப்பு நெறிமுறைகள் மற்றும் தொடர் மாற்ற உத்திகள்.

அலகு VII: இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்
(i) திருக்குறள் தொடர்பான செய்திகள், மேற்கோள்கள், நாலடியார், நான்மணிக்கடிகை, பழமொழி நானூறு.
(ii) ஐம்பெருங்காப்பியங்கள் (சிலப்பதிகாரம், மணிமேகலை), பெரியபுராணம், கம்பராமாயணம், சீறாப்புராணம், சிற்றிலக்கியங்கள்.
(iii) பாரதியார், பாரதிதாசன், நாமக்கல் கவிஞர், கவிமணி, உ.வே.சா, பெரியார், அண்ணா, மறைமலையடிகள்.
(iv) நாட்டுப்புறக் கலைகள், தமிழர் பண்பாடு, தொல்லியல் மற்றும் கீழடி அகழாய்வுகள்.`);
                setErrorMsg(null);
              }}
              title="Insert official 7-unit General Tamil syllabus (Units 1 to 7)"
            >
              <Sparkles size={11} style={{ display: 'inline', marginRight: '3px' }} />
              Sample Tamil (7 Units)
            </button>

            <button
              type="button"
              className="asw-btn-ghost"
              style={{ padding: '0.2rem 0.45rem', fontSize: '0.7rem', color: '#a78bfa' }}
              onClick={() => {
                updateTargetSubject('all');
                setRawText(`SUBJECT: GENERAL STUDIES
UNIT-I: GENERAL SCIENCE
(i) Scientific Knowledge and Scientific Temper - Mechanics - Properties of Matter, Force, Motion and Energy - Electricity and Magnetism, Light, Sound, Heat.
(ii) Elements and Compounds, Acids, Bases, Salts, Petroleum Products, Fertilizers, Pesticides.
(iii) Main concepts of Life Science, Classification of Living Organisms, Evolution, Genetics, Physiology, Nutrition, Health and Hygiene, Human diseases.
(iv) Environment and Ecology.

UNIT-II: GEOGRAPHY OF INDIA
(i) Location – Physical features – Monsoon, rainfall, weather and climate – Water resources – Rivers in India – Soil, minerals and natural resources – Forest and wildlife.
(ii) Agricultural pattern - Transport - Communication - Population density and distribution - Disaster Management.

UNIT-III: HISTORY AND CULTURE OF INDIA
(i) Indus valley civilization - Guptas, Delhi Sultans, Mughals and Marathas - Age of Vijayanagaram and Bahmani Kingdoms - South Indian history.
(ii) Change and Continuity in the Socio - Cultural History of India - Characteristics of Indian culture, Unity in diversity.

UNIT-IV: INDIAN POLITY
(i) Constitution of India - Preamble - Salient features - Union, State and Union Territory.
(ii) Citizenship, Fundamental rights, Fundamental duties, Directive Principles of State Policy.
(iii) Union Executive, Union Legislature – State Executive, State Legislature – Local Governments, Panchayat Raj.
(iv) Judiciary in India – Rule of Law - Anti-corruption measures - Lokpal and Lok Ayukta - Right to Information.

UNIT-V: INDIAN ECONOMY
(i) Nature of Indian economy – Five year plan models - Planning Commission and Niti Ayog.
(ii) Sources of revenue – Reserve Bank of India – Fiscal Policy and Monetary Policy – Finance Commission – Goods and Services Tax.
(iii) Structure of Indian Economy and Employment Generation, Land reforms and Agriculture, Industrial growth.

UNIT-VI: INDIAN NATIONAL MOVEMENT & TAMIL HERITAGE
(i) National Renaissance – Early uprising against British rule – Indian National Congress – Emergence of leaders.
(ii) Different modes of Agitation: Satyagraha and Militant movements - Communalism and partition.
(iii) History of Tamil Society, related Archaeological discoveries, Tamil Literature from Sangam age till contemporary times.
(iv) Thirukkural: Significance as a Secular literature, Relevance to Everyday Life, Impact of Thirukkural on Humanity.

SUBJECT: APTITUDE AND MENTAL ABILITY
UNIT-I: NUMERICAL ABILITY & SIMPLIFICATION
(i) Simplification and Order of Operations - Percentage - Highest Common Factor (HCF) & Lowest Common Multiple (LCM).
(ii) Ratio and Proportion - Simple and Compound Interest - Time and Work, Pipes and Cisterns.

UNIT-II: LOGICAL REASONING & MENTAL ABILITY
(i) Area, Perimeter and Volume (Mensuration 2D and 3D).
(ii) Logical Reasoning and Analytical Puzzles - Dice, Visual Reasoning and Alpha-numeric Series.
(iii) Number Series and Pattern Recognition - Data Interpretation and Graphical Representation.

SUBJECT: GENERAL ENGLISH
UNIT-I: GRAMMAR
(i) Parts of Speech - Nouns, Pronouns, Adjectives, Verbs, Adverbs, Prepositions, Conjunctions.
(ii) Subject-Verb Agreement (Concord), Tenses, Voices (Active & Passive), Sentence Patterns and Question Tags.

UNIT-II: VOCABULARY
(i) Synonyms, Antonyms, Homophones, Homonyms, Idioms, Phrasal Verbs.
(ii) Prefixes, Suffixes, Compound Words, Blended Words and British vs American English.

UNIT-III: WRITING SKILLS
(i) Formal and Informal Letter Writing, Jumbled Sentences and Paragraph Coherence.
(ii) Sentence Sequence Order, Note-Making and Summary Writing (Précis Writing).

UNIT-IV: TECHNICAL TERMS
(i) Administrative, Secretariat, Judicial, Legal and Public Administration Vocabulary.
(ii) Financial, Commercial Terminology, E-Governance and Technical Acronyms.

UNIT-V: READING COMPREHENSION
(i) Factual, Expository and Editorial Passages Comprehension.
(ii) Author Tone, Central Theme Identification, Inferences and Critical Reasoning.

UNIT-VI: TRANSLATION & LITERARY WORKS
(i) Bilingual Translation (English to Tamil & Tamil to English).
(ii) Prescribed Samacheer Poems, Figures of Speech, Prose Works and Famous Author Studies.

SUBJECT: GENERAL TAMIL
அலகு I: இலக்கணம்
(i) பொருத்துதல், பிரித்து எழுதுக, சந்திப் பிழையற்ற தொடர், எழுத்து மற்றும் சொல் இலக்கணம்.
(ii) வேர்ச்சொல் அறிதல், வினைமுற்று அமைத்தல், எதிர்ச்சொல், அணி மற்றும் யாப்பிலக்கணம்.

அலகு II: சொல்லகராதி
(i) அகரவரிசைப்படுத்துதல், எதிர்ச்சொல் அறிதல், ஒருபொருள் குறித்த பலசொற்கள்.
(ii) மரபுத் தொடர்கள், இலக்கிய வகைச் சொற்கள் (இயற்சொல், திரிசொல், திசைச்சொல், வடசொல்).

அலகு III: எழுதும் திறன்
(i) கடிதம் எழுதுதல் (அலுவல் முறை மற்றும் விண்ணப்பக் கடிதங்கள்).
(ii) பத்தி சுருக்குதல் (Note-making & Summary Writing), தொடர் ஒழுங்கு முறை.

அலகு IV: கலைச் சொற்கள்
(i) அலுவலக மற்றும் தலைமைச் செயலகக் கலைச்சொற்கள்.
(ii) நீதிமன்றம், சட்டம் மற்றும் கணினித் தமிழ்க் கலைச்சொற்கள்.

அலகு V: வாசித்தல் – புரிந்து கொள்ளும் திறன்
(i) பத்தியைப் படித்து வினாக்களுக்கு விடையளித்தல்.
(ii) உரைநடைப் பத்தி பகுப்பாய்வு மற்றும் மையக்கருத்து கண்டறிதல்.

அலகு VI: எளிய மொழிபெயர்ப்பு
(i) ஆங்கிலத்திலிருந்து தமிழாக்கம் செய்தல் மற்றும் தமிழிலிருந்து ஆங்கில மொழிபெயர்ப்பு.
(ii) சுற்றறிக்கை மற்றும் அலுவலக ஆவண மொழிபெயர்ப்பு நெறிமுறைகள்.

அலகு VII: இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்
(i) திருக்குறள், நாலடியார், பழமொழி நானூறு, ஐம்பெருங்காப்பியங்கள், சிற்றிலக்கியங்கள்.
(ii) பாரதியார், பாரதிதாசன், உ.வே.சா, பெரியார், அண்ணா, கீழடி தொல்லியல் மற்றும் தமிழர் பண்பாடு.`);
                setErrorMsg(null);
              }}
              title="Insert combined syllabus covering all 4 TNPSC Subjects"
            >
              <Sparkles size={11} style={{ display: 'inline', marginRight: '3px' }} />
              All 4 Subjects (Full)
            </button>

            {rawText.length > 0 && (
              <button
                type="button"
                className="asw-btn-ghost"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                onClick={() => setRawText('')}
              >
                Clear
              </button>
            )}
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {rawText.length > 0 ? `${rawText.length} characters` : 'Paste official syllabus text'}
            </span>
          </div>
        </div>
        <textarea
          className="asw-textarea"
          placeholder="Paste official TNPSC syllabus here (e.g. Unit I: Grammar / அலகு I: இலக்கணம் / Unit I: General Science...)"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
      </div>

      {/* Step 03: Existing Textbook Repository Selector */}
      <div className="asw-tb-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={16} className="text-cyan" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>
              03. Connect Existing Samacheer Kalvi Textbooks ({selectedTextbookIds.filter((id) => filteredAvailableTextbooks.some((tb: RepoTextbook) => tb.id === id)).length} of {filteredAvailableTextbooks.length} Selected)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              type="button"
              className="asw-btn-ghost"
              style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
              onClick={() => {
                const filteredIds = filteredAvailableTextbooks.map((tb: RepoTextbook) => tb.id);
                setSelectedTextbookIds(Array.from(new Set([...selectedTextbookIds, ...filteredIds])));
              }}
              title="Select all subject-relevant textbooks"
            >
              Select All ({filteredAvailableTextbooks.length})
            </button>
            <button
              type="button"
              className="asw-btn-ghost"
              style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem' }}
              onClick={() => {
                const filteredIdSet = new Set(filteredAvailableTextbooks.map((tb: RepoTextbook) => tb.id));
                setSelectedTextbookIds(selectedTextbookIds.filter((id) => !filteredIdSet.has(id)));
              }}
              title="Deselect subject textbooks"
            >
              Clear Selection
            </button>
            <span style={{ fontSize: '0.72rem', color: '#10b981' }}>
              <CheckCircle2 size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
              Reusing Database Records (No Upload Needed)
            </span>
          </div>
        </div>

        {loadingTextbooks ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
            <Loader2 size={20} className="spin-icon" style={{ display: 'inline', marginRight: '6px' }} />
            Loading textbook catalog...
          </div>
        ) : (
          <div className="asw-tb-grid">
            {filteredAvailableTextbooks.map((tb: RepoTextbook) => {
              const isSelected = selectedTextbookIds.includes(tb.id);
              return (
                <div
                  key={tb.id}
                  className={`asw-tb-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedTextbookIds(selectedTextbookIds.filter((id) => id !== tb.id));
                    } else {
                      setSelectedTextbookIds([...selectedTextbookIds, tb.id]);
                    }
                  }}
                >
                  <span className="asw-tb-badge">Class {tb.standard}</span>
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tb.file_name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      {tb.subject} • {tb.term}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Background Job Progress Panel */}
      {jobSnapshot && (
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {(jobSnapshot.status === 'queued' || jobSnapshot.status === 'analyzing' || jobSnapshot.status === 'matching') && (
                <Loader2 size={16} className="spin-icon" style={{ color: '#818cf8' }} />
              )}
              {jobSnapshot.status === 'completed' && <CheckCircle2 size={16} style={{ color: '#34d399' }} />}
              {(jobSnapshot.status === 'failed' || jobSnapshot.status === 'completed_with_errors') && (
                <AlertCircle size={16} style={{ color: '#f87171' }} />
              )}
              {jobSnapshot.status === 'paused' && <Pause size={16} style={{ color: '#fbbf24' }} />}

              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                Background Job: {jobSnapshot.status.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                ({jobSnapshot.id})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(jobSnapshot.status === 'queued' || jobSnapshot.status === 'analyzing' || jobSnapshot.status === 'matching') && (
                <button
                  type="button"
                  className="asw-btn-ghost"
                  onClick={() => handleJobControl('pause')}
                  disabled={controlLoading}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}
                >
                  <Pause size={13} />
                  <span>Pause</span>
                </button>
              )}

              {jobSnapshot.status === 'paused' && (
                <button
                  type="button"
                  className="asw-btn-ghost"
                  onClick={() => handleJobControl('resume')}
                  disabled={controlLoading}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#34d399', borderColor: 'rgba(52, 211, 153, 0.4)' }}
                >
                  <Play size={13} />
                  <span>Resume</span>
                </button>
              )}

              {(jobSnapshot.failedTextbooks > 0 || jobSnapshot.status === 'failed' || jobSnapshot.status === 'completed_with_errors') && (
                <button
                  type="button"
                  className="asw-btn-ghost"
                  onClick={() => handleJobControl('retry-failed')}
                  disabled={controlLoading || analyzing}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.45)' }}
                >
                  <RotateCcw size={13} />
                  <span>Retry Failed</span>
                </button>
              )}

              {(jobSnapshot.status === 'completed' || jobSnapshot.status === 'completed_with_errors') && jobSnapshot.units.length > 0 && (
                <button
                  type="button"
                  className="asw-btn-primary"
                  onClick={() => onAnalyzeComplete(jobSnapshot.units)}
                  style={{ padding: '0.35rem 0.85rem', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>Proceed to Alignment ({jobSnapshot.units.length} Units)</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar & Stage Status */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              <span style={{ fontWeight: 600 }}>
                {jobSnapshot.status === 'analyzing'
                  ? 'Stage 1/2: Analyzing Official TNPSC Syllabus with Gemini AI...'
                  : jobSnapshot.status === 'matching'
                  ? `Stage 2/2: Mapping Textbooks (${jobSnapshot.processedTextbooks}/${jobSnapshot.totalTextbooks} Processed)`
                  : jobSnapshot.status === 'completed'
                  ? 'All Stages Completed: Single Parent Units Mapped'
                  : jobSnapshot.status === 'paused'
                  ? 'Job paused — progress saved in PostgreSQL'
                  : jobSnapshot.status === 'failed'
                  ? 'Job Stopped: Error encountered'
                  : 'Initializing background job...'}
              </span>
              <strong style={{ color: '#a5b4fc', fontSize: '0.9rem' }}>{jobSnapshot.progressPercent}%</strong>
            </div>

            <div style={{ width: '100%', height: '8px', background: 'rgba(30, 41, 59, 0.9)', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${jobSnapshot.progressPercent}%`,
                  height: '100%',
                  background:
                    jobSnapshot.status === 'failed'
                      ? '#ef4444'
                      : jobSnapshot.status === 'completed_with_errors'
                      ? '#f59e0b'
                      : 'linear-gradient(90deg, #6366f1, #10b981)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            {/* Sub-status label */}
            {jobSnapshot.currentTextbook && (
              <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                {jobSnapshot.currentTextbook}
              </div>
            )}
          </div>

          {/* Completed Stages Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem', padding: '0.6rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.74rem' }}>
              {jobSnapshot.analyzedUnitsCount > 0 ? (
                <CheckCircle2 size={14} style={{ color: '#34d399', flexShrink: 0 }} />
              ) : jobSnapshot.status === 'analyzing' ? (
                <Loader2 size={14} className="spin-icon" style={{ color: '#818cf8', flexShrink: 0 }} />
              ) : jobSnapshot.status === 'failed' ? (
                <AlertCircle size={14} style={{ color: '#f87171', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #475569' }} />
              )}
              <div>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Stage 1: Syllabus Extraction</span>
                <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                  {jobSnapshot.analyzedUnitsCount > 0
                    ? `${jobSnapshot.analyzedUnitsCount} Units Extracted (Gemini AI)`
                    : jobSnapshot.status === 'analyzing'
                    ? 'In Progress with Gemini AI...'
                    : 'Pending'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.74rem' }}>
              {jobSnapshot.status === 'completed' || (jobSnapshot.totalTextbooks > 0 && jobSnapshot.processedTextbooks === jobSnapshot.totalTextbooks) ? (
                <CheckCircle2 size={14} style={{ color: '#34d399', flexShrink: 0 }} />
              ) : jobSnapshot.status === 'matching' ? (
                <Loader2 size={14} className="spin-icon" style={{ color: '#818cf8', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid #475569' }} />
              )}
              <div>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Stage 2: Textbook Alignment</span>
                <div style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                  {jobSnapshot.totalTextbooks === 0
                    ? 'No textbooks selected'
                    : `${jobSnapshot.processedTextbooks} / ${jobSnapshot.totalTextbooks} Processed (${jobSnapshot.successfulTextbooks} Matched)`}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem', fontSize: '0.75rem' }}>
            <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(30, 41, 59, 0.55)', borderRadius: '6px' }}>
              <div style={{ color: '#94a3b8' }}>Total Textbooks Selected</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>{jobSnapshot.totalTextbooks}</div>
            </div>
            <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(30, 41, 59, 0.55)', borderRadius: '6px' }}>
              <div style={{ color: '#94a3b8' }}>Textbooks Processed</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#a5b4fc' }}>
                {jobSnapshot.processedTextbooks} / {jobSnapshot.totalTextbooks}
              </div>
            </div>
            <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>
              <div style={{ color: '#6ee7b7' }}>Successful Textbooks</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#34d399' }}>{jobSnapshot.successfulTextbooks}</div>
            </div>
            <div style={{ padding: '0.5rem 0.65rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px' }}>
              <div style={{ color: '#fca5a5' }}>Failed Textbooks</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f87171' }}>{jobSnapshot.failedTextbooks}</div>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '8px', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>
              {errorStatus && (
                <span style={{ display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px', background: errorStatus === 503 ? '#f59e0b' : errorStatus === 429 ? '#8b5cf6' : errorStatus === 422 ? '#ec4899' : '#ef4444', color: '#fff', marginRight: '0.5rem' }}>
                  {errorStatus === 503 ? '503 OVERLOADED' : errorStatus === 429 ? '429 RATE LIMIT' : errorStatus === 504 ? '504 TIMEOUT' : errorStatus === 422 ? '422 INVALID JSON' : `${errorStatus} ERROR`}
                </span>
              )}
              <span>{errorMsg}</span>
            </div>
          </div>
          <button
            type="button"
            className="asw-btn-ghost"
            onClick={() => (jobSnapshot ? handleJobControl('retry-failed') : handleAnalyzeAndMatch())}
            disabled={analyzing || controlLoading}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}
          >
            {analyzing ? <Loader2 size={13} className="spin-icon" /> : <RotateCcw size={13} />}
            <span>{jobSnapshot ? 'Retry Failed' : 'Retry Analysis'}</span>
          </button>
        </div>
      )}

      {/* Trigger: Steps 04–08 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button
          type="button"
          className="asw-btn-primary"
          onClick={handleAnalyzeAndMatch}
          disabled={analyzing || !rawText.trim()}
        >
          {analyzing ? (
            <>
              <Loader2 size={16} className="spin-icon" />
              <span>Running Background Analysis ({jobSnapshot?.progressPercent ?? 0}%)...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>04. Analyze & Match Textbooks (Single Parent Unit)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
