import React, { useState } from 'react';
import type { CanonicalUnitDraft, GeneratedNotesDraft, GeneratedMCQDraft } from './types';
import { CheckCircle2, AlertTriangle, Loader2, Sparkles, Folder } from 'lucide-react';
import { apiFetch } from '../../../utils/api';

interface PhaseDPublishProps {
  examId: string;
  units: CanonicalUnitDraft[];
  notesMap: Record<string, GeneratedNotesDraft>;
  mcqsMap: Record<string, GeneratedMCQDraft[]>;
  onPublished: () => void;
  onBack: () => void;
}

export const PhaseDPublish: React.FC<PhaseDPublishProps> = ({
  examId,
  units,
  notesMap,
  mcqsMap,
  onPublished,
  onBack,
}) => {
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishResult, setPublishResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute summary stats
  const activeUnits = units.filter((u) => u.selected_for_publish !== false);
  const isTamilSubject = activeUnits.some((u) => (u.subject_slug || '').includes('tamil'));

  const [validationData, setValidationData] = useState<any | null>(null);
  const [auditData, setAuditData] = useState<any | null>(null);

  // Auto-run 9-step accuracy verification & review dashboard audit on mount
  React.useEffect(() => {
    apiFetch('/api/study-management/ai-import/validate-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ examId, units: activeUnits }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.dashboardMetrics) {
          setAuditData(d);
        }
      })
      .catch((e) => console.warn('Audit validation error:', e));

    if (isTamilSubject) {
      apiFetch('/api/study-management/ai-import/validate-tamil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, units: activeUnits }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.auditReport) {
            setValidationData(d);
          }
        })
        .catch((e) => console.warn('Validation error:', e));
    }
  }, [examId, isTamilSubject]);
  let totalLessons = 0;
  let totalTopics = 0;

  for (const u of activeUnits) {
    for (const l of u.lessons || []) {
      if (l.selected_for_publish !== false) {
        totalLessons++;
        totalTopics += l.topics?.length || 0;
      }
    }
  }

  const totalNotes = Object.keys(notesMap).length;
  const totalMCQs = Object.values(mcqsMap).reduce((acc, curr) => acc + curr.length, 0);

  const handleApproveAndPublish = async () => {
    setPublishing(true);
    setErrorMsg(null);

    try {
      const payload = {
        examId,
        subjectSlug: activeUnits[0]?.subject_slug || 'general-studies',
        subjectName: activeUnits[0]?.subject_name || 'General Studies',
        units: activeUnits,
        notes: notesMap,
        mcqs: mcqsMap,
      };

      const res = await apiFetch('/api/study-management/ai-import/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Publishing failed.');
      }

      setPublishResult(data);
      setTimeout(() => {
        onPublished();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Transaction failed while publishing.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Summary Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8' }}>{activeUnits.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginTop: '0.2rem' }}>Parent Units</div>
        </div>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#818cf8' }}>{totalLessons}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginTop: '0.2rem' }}>Mapped Lessons</div>
        </div>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#a78bfa' }}>{totalTopics}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginTop: '0.2rem' }}>Topics Verified</div>
        </div>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399' }}>{totalNotes}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginTop: '0.2rem' }}>Study Notes</div>
        </div>
        <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{totalMCQs}</div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginTop: '0.2rem' }}>Practice MCQs</div>
        </div>
      </div>

      {/* 2. Safe Merge Notice (Option A) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.85rem 1rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px' }}>
        <CheckCircle2 size={18} className="text-emerald" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.84rem', color: '#6ee7b7' }}>
          <strong>Option A: Non-Destructive Safe Merge Active.</strong> Publishing will preserve all existing database records. New standards, lessons, notes, and MCQs will be safely attached under their canonical parent units without data loss or duplicates.
        </span>
      </div>

      {/* 2.2 AI Import Review Dashboard (Section 7: 10 Mandatory Metrics & Section 8: 9-Step Accuracy Verification) */}
      {auditData?.dashboardMetrics && (
        <div style={{ padding: '1rem 1.25rem', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8' }}>
              AI Import Review Dashboard & 9-Step Accuracy Verification
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: auditData.valid ? '#34d399' : '#f87171', background: auditData.valid ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
              {auditData.valid ? '✓ 9-STEP VERIFICATION COMPLETED & PASSED' : '⚠ ACTION REQUIRED BEFORE COMMIT'}
            </span>
          </div>

          {/* 10 Mandatory Review Dashboard Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.65)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8' }}>{auditData.dashboardMetrics.totalSyllabusTopics}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>TNPSC Syllabus Topics</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.65)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#34d399' }}>{auditData.dashboardMetrics.totalMatchedTopics}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Matched Topics</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.65)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#818cf8' }}>{auditData.dashboardMetrics.totalMatchedLessons}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Matched Lessons</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.65)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#a78bfa' }}>{auditData.dashboardMetrics.totalStandardsCovered}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Standards Covered ({auditData.dashboardMetrics.standardsCoveredList.join(',')})</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.65)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fbbf24' }}>{auditData.dashboardMetrics.totalTextbookUnitsIdentified}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Textbook Units Identified</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.65)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: auditData.dashboardMetrics.missingTopicsCount === 0 ? '#34d399' : '#f87171' }}>{auditData.dashboardMetrics.missingTopicsCount}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Missing Topics</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.65)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: auditData.dashboardMetrics.unmatchedTopicsCount === 0 ? '#34d399' : '#f87171' }}>{auditData.dashboardMetrics.unmatchedTopicsCount}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Unmatched Topics</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.65)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: auditData.dashboardMetrics.duplicateRecordsCount === 0 ? '#34d399' : '#fbbf24' }}>{auditData.dashboardMetrics.duplicateRecordsCount}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Duplicate Records</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.65)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: auditData.dashboardMetrics.incorrectMappingsCount === 0 ? '#34d399' : '#f87171' }}>{auditData.dashboardMetrics.incorrectMappingsCount}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Incorrect Mappings</div>
            </div>
            <div style={{ background: 'rgba(30, 41, 59, 0.65)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: auditData.dashboardMetrics.unverifiedMappingsCount === 0 ? '#34d399' : '#f87171' }}>{auditData.dashboardMetrics.unverifiedMappingsCount}</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Unverified Mappings</div>
            </div>
          </div>

          {/* 9-Step Mandatory Accuracy Verification Pipeline */}
          {Array.isArray(auditData.nineStepVerification) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.45rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(148, 163, 184, 0.15)' }}>
              {auditData.nineStepVerification.map((s: any) => (
                <div key={s.step} style={{ background: 'rgba(30, 41, 59, 0.45)', padding: '0.45rem 0.6rem', borderRadius: '6px', border: `1px solid ${s.status === 'PASSED' ? 'rgba(52, 211, 153, 0.25)' : 'rgba(248, 113, 113, 0.35)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', fontWeight: 700, color: s.status === 'PASSED' ? '#34d399' : '#f87171' }}>
                    <span>{s.title}</span>
                    <span>{s.status === 'PASSED' ? '✓' : '✗'}</span>
                  </div>
                  <div style={{ fontSize: '0.67rem', color: '#94a3b8', marginTop: '0.15rem' }}>{s.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2.5 General Tamil Pre-Publish 12-Point Checklist & 14-Point Audit Report */}
      {isTamilSubject && validationData?.auditReport && (
        <div style={{ padding: '1rem', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(251, 191, 36, 0.35)', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fbbf24' }}>
              General Tamil Pre-Publish 12-Point Verification Checklist
            </span>
            <span style={{ fontSize: '0.75rem', color: validationData.valid ? '#34d399' : '#f87171', fontWeight: 600 }}>
              {validationData.valid ? '✓ ALL 12 CHECKS PASSED' : '⚠ CHECKS FAILED'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem', marginBottom: '0.75rem' }}>
            {validationData.auditReport.prePublishChecklist.map((c: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.74rem', color: c.passed ? '#cbd5e1' : '#f87171' }}>
                <span style={{ color: c.passed ? '#34d399' : '#ef4444', fontWeight: 700 }}>
                  {c.passed ? '✓' : '✗'}
                </span>
                <span>{c.item}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.72rem', color: '#94a3b8', paddingTop: '0.5rem', borderTop: '1px solid rgba(148, 163, 184, 0.15)' }}>
            <span>Standards Covered: Classes {validationData.auditReport.standardsCovered.join(', ')}</span>
            <span>•</span>
            <span>Lessons Mapped: {validationData.auditReport.totalLessons}</span>
            <span>•</span>
            <span>Topics Verified: {validationData.auditReport.totalTopics}</span>
            <span>•</span>
            <span>Duplicates Prevented: {validationData.auditReport.duplicateLessonsDetected}</span>
          </div>
        </div>
      )}

      {/* 3. Review Hierarchy Tree */}
      <div style={{ maxHeight: '340px', overflowY: 'auto', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(148, 163, 184, 0.15)', borderRadius: '10px', padding: '1rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
          Final Hierarchy Preview: Single Parent Containers & Nested Standards
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {activeUnits.map((u) => (
            <div key={`${u.subject_slug || 'general-studies'}_${u.unit_number}`} style={{ padding: '0.65rem 0.85rem', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Folder size={15} className="text-purple" />
                <span style={{ fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                  {u.subject_name || 'General Studies'}
                </span>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f1f5f9' }}>
                  {u.unit_code}: {u.title}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                  {u.lessons.length} lessons mapped
                </span>
              </div>

              {/* Standard & Textbook Unit hierarchy preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.5rem', paddingLeft: '1.4rem' }}>
                {[6, 7, 8, 9, 10, 11, 12].map((std) => {
                  const stdLessons = u.lessons.filter((l) => l.standard_number === std && l.selected_for_publish !== false);
                  if (stdLessons.length === 0) return null;
                  return (
                    <div key={std} style={{ background: 'rgba(15, 23, 42, 0.55)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.25rem' }}>
                        {std}th Standard ({stdLessons.length} lessons)
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.75rem' }}>
                        {stdLessons.map((l, lIdx) => {
                          const tbUnit = l.textbook_unit_title || `Textbook Unit ${String(l.lesson_number || '1.1').split('.')[0]}`;
                          return (
                            <div key={lIdx} style={{ fontSize: '0.71rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <span style={{ color: '#fbbf24', fontWeight: 600 }}>[{tbUnit}]</span>
                              <span style={{ color: '#f8fafc', fontWeight: 600 }}>Lesson {l.lesson_number} – {l.title}</span>
                              <span style={{ color: '#94a3b8' }}>({(l.topics || []).length} topics)</span>
                              <span style={{ color: '#818cf8', fontSize: '0.67rem' }}>• Ref: {l.syllabus_reference || `${u.unit_code}`}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <AlertTriangle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {publishResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'rgba(52, 211, 153, 0.12)', border: '1px solid rgba(52, 211, 153, 0.4)', borderRadius: '10px', color: '#6ee7b7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.92rem', fontWeight: 700 }}>
            <CheckCircle2 size={18} className="text-emerald" />
            <span>{publishResult.message || 'Syllabus and lessons published successfully!'}</span>
          </div>

          {/* Validation Report Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '0.4rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
                {publishResult.stats?.validation_report?.total_units_identified ?? (publishResult.stats?.units_created + publishResult.stats?.units_updated)}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Units Processed</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#818cf8' }}>
                {publishResult.stats?.validation_report?.total_lessons_created_or_reused ?? (publishResult.stats?.lessons_created + publishResult.stats?.lessons_updated)}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Lessons Synced</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>
                {publishResult.stats?.validation_report?.total_topics_created_or_reused ?? publishResult.stats?.topics_created}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Topics Verified</div>
            </div>
            <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fbbf24' }}>
                {publishResult.stats?.validation_report?.duplicates_detected ?? (publishResult.stats?.duplicates_detected || 0)}
              </div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Duplicates Prevented</div>
            </div>
          </div>

          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '0.2rem' }}>
            <span>Created: {publishResult.stats?.units_created} units, {publishResult.stats?.lessons_created} lessons, {publishResult.stats?.topics_created} topics • </span>
            <span>Reused/Updated: {publishResult.stats?.units_updated} units, {publishResult.stats?.lessons_updated} lessons • </span>
            <span>Study Notes: {publishResult.stats?.notes_saved} • MCQs: {publishResult.stats?.mcqs_saved}</span>
          </div>
        </div>
      )}

      {/* 4. Action Footer */}
      <div className="asw-modal-footer" style={{ margin: '0 -1.75rem -1.5rem', borderTop: '1px solid rgba(148, 163, 184, 0.15)' }}>
        <button type="button" className="asw-btn-ghost" onClick={onBack} disabled={publishing}>
          Back to Content
        </button>

        <button
          type="button"
          className="asw-btn-primary"
          onClick={handleApproveAndPublish}
          disabled={publishing || activeUnits.length === 0}
          style={{ background: '#10b981', color: '#fff' }}
        >
          {publishing ? (
            <>
              <Loader2 size={16} className="spin-icon" />
              <span>Publishing Transaction to PostgreSQL...</span>
            </>
          ) : (
            <>
              <Sparkles size={16} />
              <span>Approve & Commit to Database (Step 12)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
