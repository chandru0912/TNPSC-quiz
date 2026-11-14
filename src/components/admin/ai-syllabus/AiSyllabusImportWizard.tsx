import React, { useState, useEffect } from 'react';
import { X, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react';
import type { WizardStage, CanonicalUnitDraft, GeneratedNotesDraft, GeneratedMCQDraft } from './types';
import { PhaseASetup } from './PhaseASetup';
import { PhaseBAlignment } from './PhaseBAlignment';
import { PhaseCContent } from './PhaseCContent';
import { PhaseDPublish } from './PhaseDPublish';
import './AiSyllabusWizard.css';

interface AiSyllabusImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished: () => void;
}

const SESSION_STORAGE_KEY = 'tnpsc_ai_syllabus_import_draft_v2';

export const AiSyllabusImportWizard: React.FC<AiSyllabusImportWizardProps> = ({
  isOpen,
  onClose,
  onPublished,
}) => {
  const [stage, setStage] = useState<WizardStage>('setup');
  const [examId, setExamId] = useState<string>('group1');
  const [targetSubject, setTargetSubject] = useState<string>('all');
  const [rawText, setRawText] = useState<string>('');
  const [selectedStandards, setSelectedStandards] = useState<number[]>([6, 7, 8, 9, 10, 11, 12]);
  const [selectedTextbookIds, setSelectedTextbookIds] = useState<number[]>([]);
  const [units, setUnits] = useState<CanonicalUnitDraft[]>([]);
  const [notesMap, setNotesMap] = useState<Record<string, GeneratedNotesDraft>>({});
  const [mcqsMap, setMcqsMap] = useState<Record<string, GeneratedMCQDraft[]>>({});
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Restore draft from sessionStorage on load
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.stage) setStage(parsed.stage);
        if (parsed.examId) setExamId(parsed.examId === 'group2a' ? 'group2' : parsed.examId);
        if (parsed.targetSubject) setTargetSubject(parsed.targetSubject);
        if (parsed.rawText) setRawText(parsed.rawText);
        if (Array.isArray(parsed.selectedStandards) && parsed.selectedStandards.length > 0) {
          setSelectedStandards(parsed.selectedStandards);
        }
        if (Array.isArray(parsed.selectedTextbookIds)) setSelectedTextbookIds(parsed.selectedTextbookIds);
        if (Array.isArray(parsed.units) && parsed.units.length > 0) setUnits(parsed.units);
        if (parsed.notesMap) setNotesMap(parsed.notesMap);
        if (parsed.mcqsMap) setMcqsMap(parsed.mcqsMap);
        if (parsed.activeJobId) setActiveJobId(parsed.activeJobId);
      }
    } catch (e) {
      console.warn('Could not restore syllabus draft from session', e);
    }
  }, []);

  // Save working state to sessionStorage
  useEffect(() => {
    if (units.length > 0 || rawText.length > 0 || activeJobId) {
      try {
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({
            stage,
            examId,
            targetSubject,
            rawText,
            selectedStandards,
            selectedTextbookIds,
            units,
            notesMap,
            mcqsMap,
            activeJobId,
          })
        );
      } catch (e) {
        console.warn('Could not save draft to session', e);
      }
    }
  }, [stage, examId, targetSubject, rawText, selectedStandards, selectedTextbookIds, units, notesMap, mcqsMap, activeJobId]);

  const handleResetDraft = () => {
    if (confirm('Are you sure you want to reset the import wizard and clear draft data?')) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      setStage('setup');
      setTargetSubject('all');
      setRawText('');
      setSelectedStandards([6, 7, 8, 9, 10, 11, 12]);
      setSelectedTextbookIds([]);
      setUnits([]);
      setNotesMap({});
      setMcqsMap({});
      setActiveJobId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="asw-modal-overlay">
      <div className="asw-modal-container">
        {/* Header */}
        <div className="asw-modal-header">
          <div className="asw-header-title">
            <Sparkles size={22} style={{ color: '#a855f7' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>AI Syllabus Import</h3>
                <span className="asw-header-badge">12-Step Architecture</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Official TNPSC Syllabus ➔ Samacheer Kalvi 6th–12th Textbooks ➔ Single Parent Unit ➔ Notes & MCQs
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="asw-btn-ghost"
              onClick={handleResetDraft}
              title="Reset and clear current session draft"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RotateCcw size={13} />
              <span>Reset Draft</span>
            </button>
            <button
              type="button"
              className="asw-btn-ghost"
              onClick={onClose}
              style={{ padding: '0.35rem', borderRadius: '50%' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 4-Stage Stepper Bar */}
        <div className="asw-stepper-bar">
          <div
            className={`asw-step-pill ${stage === 'setup' ? 'active' : units.length > 0 ? 'completed' : ''}`}
            onClick={() => setStage('setup')}
          >
            {units.length > 0 ? <CheckCircle2 size={14} /> : <span>1</span>}
            <span>Setup & Extraction (01–04)</span>
          </div>

          <div className="asw-stepper-divider" />

          <div
            className={`asw-step-pill ${stage === 'alignment' ? 'active' : stage === 'content' || stage === 'publish' ? 'completed' : ''}`}
            onClick={() => {
              if (units.length > 0) setStage('alignment');
            }}
          >
            {stage === 'content' || stage === 'publish' ? <CheckCircle2 size={14} /> : <span>2</span>}
            <span>Single Parent Alignment (05–09)</span>
          </div>

          <div className="asw-stepper-divider" />

          <div
            className={`asw-step-pill ${stage === 'content' ? 'active' : stage === 'publish' ? 'completed' : ''}`}
            onClick={() => {
              if (units.length > 0) setStage('content');
            }}
          >
            {stage === 'publish' ? <CheckCircle2 size={14} /> : <span>3</span>}
            <span>Content Synthesis (10–11)</span>
          </div>

          <div className="asw-stepper-divider" />

          <div
            className={`asw-step-pill ${stage === 'publish' ? 'active' : ''}`}
            onClick={() => {
              if (units.length > 0) setStage('publish');
            }}
          >
            <span>4</span>
            <span>Review & Publish (12)</span>
          </div>
        </div>

        {/* Modal Body: Active Phase */}
        <div className="asw-modal-body">
          {stage === 'setup' && (
            <PhaseASetup
              examId={examId}
              setExamId={setExamId}
              targetSubject={targetSubject}
              setTargetSubject={setTargetSubject}
              rawText={rawText}
              setRawText={setRawText}
              selectedStandards={selectedStandards}
              setSelectedStandards={setSelectedStandards}
              selectedTextbookIds={selectedTextbookIds}
              setSelectedTextbookIds={setSelectedTextbookIds}
              activeJobId={activeJobId}
              setActiveJobId={setActiveJobId}
              onAnalyzeComplete={(extractedUnits) => {
                setUnits(extractedUnits);
                setStage('alignment');
              }}
            />
          )}

          {stage === 'alignment' && (
            <PhaseBAlignment
              examId={examId}
              units={units}
              setUnits={setUnits}
              selectedStandards={selectedStandards}
              selectedTextbookIds={selectedTextbookIds}
              onNext={() => setStage('content')}
              onBack={() => setStage('setup')}
            />
          )}

          {stage === 'content' && (
            <PhaseCContent
              units={units}
              notesMap={notesMap}
              setNotesMap={setNotesMap}
              mcqsMap={mcqsMap}
              setMcqsMap={setMcqsMap}
              onNext={() => setStage('publish')}
              onBack={() => setStage('alignment')}
            />
          )}

          {stage === 'publish' && (
            <PhaseDPublish
              examId={examId}
              units={units}
              notesMap={notesMap}
              mcqsMap={mcqsMap}
              onPublished={() => {
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
                onPublished();
              }}
              onBack={() => setStage('content')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
