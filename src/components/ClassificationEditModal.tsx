import React, { useState, useMemo } from 'react'
import { X, Check, BookOpen, ShieldCheck } from 'lucide-react'
import type { ClassifiedPdfMetadata } from '../../backend/src/services/bulkClassificationService'
import {
  STANDARDS_LIST,
  getSubjectsForStandard,
  getAllowedMediums,
  getAllowedTerms,
  type StandardId,
} from '../../backend/src/data/samacheerTextbookCatalog'

interface ClassificationEditModalProps {
  isOpen: boolean;
  item: ClassifiedPdfMetadata | null;
  onClose: () => void;
  onSave: (updatedItem: ClassifiedPdfMetadata) => void;
}

export const ClassificationEditModal: React.FC<ClassificationEditModalProps> = ({
  isOpen,
  item,
  onClose,
  onSave,
}) => {
  if (!isOpen || !item) return null

  const [standard, setStandard] = useState<StandardId>(item.standard)
  const [subject, setSubject] = useState<string>(item.subject)
  const [medium, setMedium] = useState<'Tamil' | 'English'>(item.medium)
  const [term, setTerm] = useState<string>(item.term)
  const [applicableGroups, setApplicableGroups] = useState<Array<'group1' | 'group2' | 'group4'>>(
    item.applicableGroups || [item.primaryGroup || 'group1']
  )

  const availableSubjects = useMemo(() => {
    return getSubjectsForStandard(standard)
  }, [standard])

  const availableMediums = useMemo(() => {
    return getAllowedMediums(standard, subject)
  }, [standard, subject])

  const availableTerms = useMemo(() => {
    return getAllowedTerms(standard, subject)
  }, [standard, subject])

  const handleGroupToggle = (group: 'group1' | 'group2' | 'group4') => {
    if (applicableGroups.includes(group)) {
      if (applicableGroups.length === 1) return // Keep at least one
      setApplicableGroups(applicableGroups.filter((g) => g !== group))
    } else {
      setApplicableGroups([...applicableGroups, group])
    }
  }

  const handleSave = () => {
    const stdNum = parseInt(standard, 10)
    const selectedSubObj = availableSubjects.find((s) => s.name === subject) || availableSubjects[0]

    const updated: ClassifiedPdfMetadata = {
      ...item,
      standard,
      standardNumber: stdNum,
      subject: selectedSubObj?.name || subject,
      subjectId: selectedSubObj?.id || subject.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      tamilSubjectName: selectedSubObj?.tamilName || subject,
      medium,
      term,
      applicableGroups,
      primaryGroup: applicableGroups[0] || 'group1',
      bookName: `Samacheer Kalvi ${standard} Standard - ${selectedSubObj?.name || subject} - ${term} - ${medium} Medium`,
      confidenceScore: 100, // Manual approval confers maximum confidence
      confidenceLevel: 'high',
      confidenceReasons: [...item.confidenceReasons, 'Manually reviewed and approved by administrator'],
      requiresReview: false,
    }

    onSave(updated)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 10, 20, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'linear-gradient(135deg, rgba(20, 28, 48, 0.96), rgba(15, 23, 42, 0.98))',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55)',
          color: '#f8fafc',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.18)',
                color: '#818cf8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Edit Syllabus Classification</h3>
              <p
                style={{
                  margin: '0.15rem 0 0',
                  fontSize: '0.78rem',
                  color: 'rgba(255, 255, 255, 0.55)',
                  maxWidth: '380px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.fileName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Standard */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
              Standard (Class)
            </label>
            <select
              value={standard}
              onChange={(e) => {
                const newStd = e.target.value as StandardId
                setStandard(newStd)
                const newSubs = getSubjectsForStandard(newStd)
                if (!newSubs.some((s) => s.name === subject)) {
                  setSubject(newSubs[0]?.name || 'Tamil')
                }
              }}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                fontSize: '0.9rem',
              }}
            >
              {STANDARDS_LIST.map((std) => (
                <option key={std.id} value={std.id}>
                  {std.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                fontSize: '0.9rem',
              }}
            >
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} ({s.tamilName})
                </option>
              ))}
            </select>
          </div>

          {/* Medium & Term in 2 columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Medium
              </label>
              <select
                value={medium}
                onChange={(e) => setMedium(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontSize: '0.9rem',
                }}
              >
                {availableMediums.map((m) => (
                  <option key={m} value={m}>
                    {m} Medium
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Term / Volume
              </label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontSize: '0.9rem',
                }}
              >
                {availableTerms.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Applicable TNPSC Groups */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.5rem' }}>
              Applicable TNPSC Exam Groups
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {[
                { id: 'group1' as const, label: 'TNPSC Group 1' },
                { id: 'group2' as const, label: 'TNPSC Group 2 & 2A' },
                { id: 'group4' as const, label: 'TNPSC Group 4 & VAO' },
              ].map((grp) => {
                const isSelected = applicableGroups.includes(grp.id)
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => handleGroupToggle(grp.id)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                      background: isSelected ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#6ee7b7' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected && <Check size={14} />}
                    {grp.label}
                  </button>
                )
              })}
            </div>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.45)' }}>
              This PDF will be discoverable under all selected groups without duplicating physical Google Drive storage.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '0.55rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: 'transparent',
              color: '#cbd5e1',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            <ShieldCheck size={16} />
            Confirm Classification
          </button>
        </div>
      </div>
    </div>
  )
}
