import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Edit2,
  FileCheck,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '../../utils/api'
import {
  parseBulkMcqText,
  revalidateParsedBatch,
  type ParsedBulkMcq,
  type ParsedMcqStatus,
} from '../../utils/bulkMcqParser'

export interface BulkMcqSyllabusMapping {
  category: string
  subject: string
  classId: number
  term: string
  unitId: number
  lessonNumber: string
  lessonTitle: string
  lessonId: string | null
  topic: string
  difficulty: 'Easy' | 'Medium' | 'Moderate' | 'Hard' | 'Difficult' | 'Advanced'
  language: 'tamil' | 'english'
  sourceReference?: string
}

interface Props {
  token: string | null
  targetSystem: 'study_materials' | 'main_practice'
  syllabus: BulkMcqSyllabusMapping
  onSyllabusFieldChange: (patch: Partial<BulkMcqSyllabusMapping>) => void
  onUploadComplete: (insertedCount: number) => void
  onViewInQuestionBank: () => void
  showToast: (type: 'success' | 'error', message: string) => void
}

const SAMPLE_PASTE = `Question 1: What is the SI unit of length?

A) Kilogram
B) Metre
C) Second
D) Kelvin

Correct Answer: B) Metre

Explanation: Metre is the SI unit of length.

Question 2: Which instrument is used to measure temperature?

A) Barometer
B) Thermometer
C) Ammeter
D) Speedometer

Correct Answer: B) Thermometer

Explanation: A thermometer is used to measure temperature.`

export const BulkMcqPastePanel: React.FC<Props> = ({
  token,
  targetSystem,
  syllabus,
  onSyllabusFieldChange,
  onUploadComplete,
  onViewInQuestionBank,
  showToast,
}) => {
  const [rawPaste, setRawPaste] = useState('')
  const [parsedItems, setParsedItems] = useState<ParsedBulkMcq[]>([])
  const [filterStatus, setFilterStatus] = useState<'all' | ParsedMcqStatus>('all')
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [serverValidatedAt, setServerValidatedAt] = useState<string | null>(null)
  const [uploadReport, setUploadReport] = useState<{
    inserted: number
    duplicates: number
    failed: number
    insertedIds: number[]
  } | null>(null)

  const stats = useMemo(() => {
    const total = parsedItems.length
    const valid = parsedItems.filter((i) => i.status === 'valid').length
    const duplicate = parsedItems.filter((i) => i.status === 'duplicate').length
    const error = parsedItems.filter((i) => i.status === 'error').length
    const parsedOk = valid + duplicate
    return { total, parsedOk, valid, duplicate, error }
  }, [parsedItems])

  const filteredItems = useMemo(() => {
    if (filterStatus === 'all') return parsedItems
    return parsedItems.filter((i) => i.status === filterStatus)
  }, [parsedItems, filterStatus])

  const handleParse = () => {
    if (!rawPaste.trim()) {
      showToast('error', 'Paste MCQ text into the editor first.')
      return
    }
    const items = parseBulkMcqText(rawPaste, {
      topic: syllabus.topic || syllabus.lessonTitle || 'General',
      difficulty: syllabus.difficulty || 'Medium',
    })
    setParsedItems(items)
    setServerValidatedAt(null)
    setUploadReport(null)
    setEditingRowId(null)
    if (items.length === 0) {
      showToast('error', 'No questions could be detected. Check the pasted format.')
    } else {
      showToast(
        'success',
        `Parsed ${items.length} question(s): ${items.filter((i) => i.status === 'valid').length} valid, ${items.filter((i) => i.status === 'duplicate').length} duplicate, ${items.filter((i) => i.status === 'error').length} error.`
      )
    }
  }

  const handleValidateServer = async () => {
    if (parsedItems.length === 0) {
      showToast('error', 'Parse pasted MCQs before running validation.')
      return
    }
    if (!syllabus.lessonTitle.trim()) {
      showToast('error', 'Select a Lesson Title in the syllabus section above before validating.')
      return
    }

    setIsValidating(true)
    try {
      const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
      const res = await apiFetch('/api/questions/validate-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          category: syllabus.category,
          subject: syllabus.subject,
          classId: syllabus.classId,
          term: syllabus.term,
          unitId: syllabus.unitId,
          lessonId: syllabus.lessonId,
          lessonTitle: syllabus.lessonTitle,
          topic: syllabus.topic,
          questions: parsedItems.map((item) => ({
            clientId: item.clientId,
            question: item.question,
            options: item.options,
            correctAnswer: item.correctAnswer,
            explanation: item.explanation,
            topic: item.topic || syllabus.topic,
            difficulty: item.difficulty || syllabus.difficulty,
            lessonTitle: syllabus.lessonTitle,
            subject: syllabus.subject,
            classId: syllabus.classId,
            unitId: syllabus.unitId,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok || json.status !== 'success') {
        showToast('error', json.message || 'Server validation failed.')
        return
      }

      const resultById = new Map<string, any>()
      for (const r of json.results || []) {
        if (r.clientId) resultById.set(r.clientId, r)
      }

      setParsedItems((prev) =>
        prev.map((item) => {
          const r = resultById.get(item.clientId)
          if (!r) return item
          // Keep suspicious answer key warning if client flagged it and admin hasn't edited it
          const suspicious = item.issues.filter((msg) => msg.startsWith('Suspicious answer key:'))
          const mergedIssues = [...suspicious, ...(Array.isArray(r.issues) ? r.issues : [])]
          const finalStatus: ParsedMcqStatus =
            suspicious.length > 0 ? 'error' : (r.status as ParsedMcqStatus)
          return {
            ...item,
            status: finalStatus,
            issues: mergedIssues,
            duplicateReason: r.duplicateReason || null,
            matchedQuestion: r.matchedQuestion || null,
            correctAnswer: r.resolvedCorrectAnswer !== undefined ? r.resolvedCorrectAnswer : item.correctAnswer,
            serverValidated: true,
          }
        })
      )
      setServerValidatedAt(new Date().toLocaleTimeString())
      const s = json.summary
      showToast(
        'success',
        `Validated against DB (${s.existingDbChecked} existing): ${s.valid} ready, ${s.duplicate} duplicate, ${s.invalid} invalid.`
      )
    } catch (err: any) {
      showToast('error', err?.message || 'Validation request failed.')
    } finally {
      setIsValidating(false)
    }
  }

  const handleUploadToStaging = async () => {
    const readyItems = parsedItems.filter((i) => i.status === 'valid' && i.correctAnswer !== null)
    if (readyItems.length === 0) {
      showToast('error', 'No valid questions are ready to upload. Fix errors or parse questions first.')
      return
    }
    if (!syllabus.lessonTitle.trim()) {
      showToast('error', 'Please select a Lesson Title before uploading to Staging.')
      return
    }
    if (!syllabus.topic.trim() && readyItems.some((i) => !i.topic.trim())) {
      showToast('error', 'Please select or enter a Topic before uploading to Staging.')
      return
    }

    setIsUploading(true)
    setUploadReport(null)
    const CHUNK_SIZE = 50
    let totalInserted = 0
    let totalDuplicates = 0
    let totalFailed = 0
    const allInsertedIds: number[] = []

    try {
      const activeToken = token || localStorage.getItem('tnpsc_admin_token') || ''
      setUploadProgress({ done: 0, total: readyItems.length })

      for (let offset = 0; offset < readyItems.length; offset += CHUNK_SIZE) {
        const chunk = readyItems.slice(offset, offset + CHUNK_SIZE)
        const payload = {
          category: syllabus.category,
          term: syllabus.term,
          lessonNumber: syllabus.lessonNumber,
          lessonId: syllabus.lessonId,
          language: syllabus.language,
          targetSystem,
          questions: chunk.map((item) => ({
            category: syllabus.category,
            subject: syllabus.subject,
            classId: syllabus.classId,
            term: syllabus.term,
            unitId: syllabus.unitId,
            lessonNumber: syllabus.lessonNumber || null,
            lessonTitle: syllabus.lessonTitle,
            lessonId: syllabus.lessonId,
            topic: item.topic.trim() || syllabus.topic.trim() || syllabus.lessonTitle,
            difficulty: item.difficulty || syllabus.difficulty || 'Medium',
            question: item.question.trim(),
            options: item.options.map((o) => o.trim()),
            correctAnswer: item.correctAnswer,
            explanation: item.explanation.trim() || `Correct answer: ${item.options[item.correctAnswer || 0]}`,
            sourceReference: syllabus.sourceReference || `Samacheer Kalvi Class ${syllabus.classId} • ${syllabus.lessonTitle}`,
            sourcePage: item.sourcePage,
            language: syllabus.language,
            targetSystem,
            status: 'staging',
          })),
        }

        const res = await apiFetch('/api/questions/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (res.ok && json.status === 'success') {
          const chunkInserted = Number(json.inserted ?? json.insertedCount ?? 0)
          totalInserted += chunkInserted
          totalDuplicates += Number(json.skippedDuplicates ?? 0)
          if (Array.isArray(json.insertedIds)) {
            allInsertedIds.push(...json.insertedIds.map(Number).filter(Number.isFinite))
          }
        } else {
          totalFailed += chunk.length
          showToast('error', json.message || `Batch ${offset + 1}–${offset + chunk.length} failed to upload.`)
        }
        setUploadProgress({ done: Math.min(readyItems.length, offset + chunk.length), total: readyItems.length })
      }

      setUploadReport({
        inserted: totalInserted,
        duplicates: totalDuplicates,
        failed: totalFailed,
        insertedIds: allInsertedIds,
      })
      if (totalInserted > 0) {
        showToast(
          'success',
          `Saved ${totalInserted} question(s) to PostgreSQL Staging${totalDuplicates > 0 ? ` (${totalDuplicates} duplicate(s) skipped)` : ''}. Click "View in Question Bank" to review & publish.`
        )
        onUploadComplete(totalInserted)
      } else if (totalDuplicates > 0 && totalFailed === 0) {
        showToast('error', `All ${totalDuplicates} question(s) were skipped as duplicates already in the database.`)
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Bulk staging upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  const updateItem = (clientId: string, patch: Partial<ParsedBulkMcq>) => {
    setParsedItems((prev) => {
      const updated = prev.map((it) =>
        it.clientId === clientId
          ? {
              ...it,
              ...patch,
              // Clear suspicious warning once admin edits the row
              issues: it.issues.filter((m) => !m.startsWith('Suspicious answer key:')),
              serverValidated: false,
            }
          : it
      )
      return revalidateParsedBatch(updated)
    })
  }

  const removeItem = (clientId: string) => {
    setParsedItems((prev) => revalidateParsedBatch(prev.filter((it) => it.clientId !== clientId)))
    if (editingRowId === clientId) setEditingRowId(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Term & Lesson Number Supplemental Mapping Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.75rem',
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}
      >
        <div className="form-field" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.76rem' }}>Term</label>
          <select
            className="filter-select"
            style={{ width: '100%', padding: '0.5rem' }}
            value={syllabus.term}
            onChange={(e) => onSyllabusFieldChange({ term: e.target.value })}
          >
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Term 3">Term 3</option>
            <option value="Full Year">Full Year</option>
          </select>
        </div>

        <div className="form-field" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.76rem' }}>Lesson Number</label>
          <input
            type="text"
            value={syllabus.lessonNumber}
            onChange={(e) => onSyllabusFieldChange({ lessonNumber: e.target.value })}
            placeholder="e.g. 1.1"
            style={{ padding: '0.5rem' }}
          />
        </div>

        <div className="form-field" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.76rem' }}>Language</label>
          <select
            className="filter-select"
            style={{ width: '100%', padding: '0.5rem' }}
            value={syllabus.language}
            onChange={(e) => onSyllabusFieldChange({ language: e.target.value as 'tamil' | 'english' })}
          >
            <option value="english">English</option>
            <option value="tamil">Tamil</option>
          </select>
        </div>

        <div className="form-field" style={{ margin: 0 }}>
          <label style={{ fontSize: '0.76rem' }}>Default Difficulty</label>
          <select
            className="filter-select"
            style={{ width: '100%', padding: '0.5rem' }}
            value={syllabus.difficulty}
            onChange={(e) => onSyllabusFieldChange({ difficulty: e.target.value as any })}
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Moderate">Moderate</option>
            <option value="Hard">Hard</option>
            <option value="Difficult">Difficult</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Active Syllabus Summary Pill */}
      <div
        style={{
          fontSize: '0.78rem',
          color: '#cbd5e1',
          padding: '0.55rem 0.85rem',
          borderRadius: '8px',
          background: 'rgba(251, 191, 36, 0.08)',
          border: '1px solid rgba(251, 191, 36, 0.25)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <strong style={{ color: '#fbbf24' }}>Target Mapping:</strong>
        <span>{syllabus.category.toUpperCase()}</span> → <span>{syllabus.subject}</span> →{' '}
        <span>Std {syllabus.classId}</span> → <span>{syllabus.term}</span> → <span>Unit {syllabus.unitId}</span> →{' '}
        <span>
          {syllabus.lessonNumber ? `${syllabus.lessonNumber} ` : ''}
          {syllabus.lessonTitle || '(Select Lesson Above)'}
        </span>{' '}
        → <span>{syllabus.topic || '(Select Topic Above)'}</span>
      </div>

      {/* Bulk Paste Text Editor */}
      <div className="form-field" style={{ margin: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.4rem',
          }}
        >
          <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ClipboardPaste size={15} color="#fbbf24" />
            <span>Bulk MCQ Paste Editor (Paste 10, 50, 100, or 200+ MCQs)</span>
          </label>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
              onClick={() => setRawPaste(SAMPLE_PASTE)}
            >
              Load Sample
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
              onClick={() => {
                setRawPaste('')
                setParsedItems([])
                setServerValidatedAt(null)
                setUploadReport(null)
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <textarea
          rows={11}
          value={rawPaste}
          onChange={(e) => setRawPaste(e.target.value)}
          placeholder={`Paste MCQs here (supports Question 1:, Q1., 1., A)/B)/C)/D), (A)/(B)/(C)/(D), Tamil அ/ஆ/இ/ஈ, Correct Answer:, Explanation:, Topic:, Difficulty:)...\n\n${SAMPLE_PASTE}`}
          style={{
            width: '100%',
            minHeight: '220px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '0.84rem',
            lineHeight: 1.5,
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.65rem', alignItems: 'center' }}>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleParse}
            disabled={!rawPaste.trim() || isUploading}
          >
            <FileCheck size={15} />
            <span>Parse Pasted MCQs</span>
          </button>

          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={handleValidateServer}
            disabled={parsedItems.length === 0 || isValidating || isUploading}
          >
            <ShieldCheck size={15} />
            <span>{isValidating ? 'Validating against DB...' : 'Validate Questions'}</span>
          </button>

          <button
            type="button"
            className="admin-btn"
            onClick={handleUploadToStaging}
            disabled={stats.valid === 0 || isUploading}
            style={{
              background: stats.valid > 0 ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(16, 185, 129, 0.15)',
              color: stats.valid > 0 ? '#ffffff' : '#64748b',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              cursor: stats.valid > 0 && !isUploading ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.84rem',
            }}
          >
            <UploadCloud size={15} />
            <span>
              {isUploading && uploadProgress
                ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...`
                : `Upload to Staging (${stats.valid})`}
            </span>
          </button>

          {serverValidatedAt && (
            <span style={{ fontSize: '0.75rem', color: '#34d399' }}>
              ✓ DB-validated at {serverValidatedAt}
            </span>
          )}
        </div>
      </div>

      {/* Upload Result Banner with View in Question Bank Action */}
      {uploadReport && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            fontSize: '0.82rem',
            color: '#d1fae5',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.85rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <strong>Staging Upload Complete:</strong>
            <span>Saved to PostgreSQL Staging: <strong>{uploadReport.inserted}</strong></span>
            <span>Skipped Duplicates: <strong>{uploadReport.duplicates}</strong></span>
            {uploadReport.failed > 0 && (
              <span style={{ color: '#fca5a5' }}>Failed: <strong>{uploadReport.failed}</strong></span>
            )}
            {uploadReport.insertedIds.length > 0 && (
              <span style={{ fontSize: '0.74rem', color: '#a7f3d0' }}>
                IDs: #{uploadReport.insertedIds[0]}
                {uploadReport.insertedIds.length > 1
                  ? ` – #${uploadReport.insertedIds[uploadReport.insertedIds.length - 1]}`
                  : ''}
              </span>
            )}
          </div>
          {uploadReport.inserted > 0 && (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={onViewInQuestionBank}
              style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem' }}
            >
              <CheckCircle2 size={14} />
              <span>View in Question Bank (Staging)</span>
            </button>
          )}
        </div>
      )}

      {/* Summary Stats & Filter Tabs */}
      {parsedItems.length > 0 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))',
              gap: '0.55rem',
            }}
          >
            {[
              { label: 'Total Pasted', value: stats.total, color: '#e2e8f0' },
              { label: 'Parsed Successfully', value: stats.parsedOk, color: '#38bdf8' },
              { label: 'Duplicate Questions', value: stats.duplicate, color: '#fbbf24' },
              { label: 'Invalid / Errors', value: stats.error, color: '#f87171' },
              { label: 'Ready to Upload', value: stats.valid, color: '#34d399' },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(30, 41, 59, 0.65)',
                  border: '1px solid rgba(148, 163, 184, 0.16)',
                }}
              >
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{card.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {(['all', 'valid', 'duplicate', 'error'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterStatus(tab)}
                style={{
                  padding: '0.32rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid rgba(148, 163, 184, 0.28)',
                  background: filterStatus === tab ? 'rgba(251, 191, 36, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                  color: filterStatus === tab ? '#fbbf24' : '#cbd5e1',
                  textTransform: 'capitalize',
                }}
              >
                {tab} ({tab === 'all' ? stats.total : tab === 'valid' ? stats.valid : tab === 'duplicate' ? stats.duplicate : stats.error})
              </button>
            ))}
          </div>

          {/* Import Preview Table */}
          <div
            style={{
              borderRadius: '10px',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              overflowX: 'auto',
              background: 'rgba(15, 23, 42, 0.55)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', color: '#e2e8f0' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '0.55rem', width: '40px' }}>#</th>
                  <th style={{ padding: '0.55rem', minWidth: '220px' }}>Question</th>
                  <th style={{ padding: '0.55rem', minWidth: '210px' }}>Options (A–D)</th>
                  <th style={{ padding: '0.55rem', minWidth: '120px' }}>Correct Answer</th>
                  <th style={{ padding: '0.55rem', minWidth: '170px' }}>Explanation</th>
                  <th style={{ padding: '0.55rem', minWidth: '110px' }}>Topic</th>
                  <th style={{ padding: '0.55rem', minWidth: '115px' }}>Status</th>
                  <th style={{ padding: '0.55rem', width: '80px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isEditing = editingRowId === item.clientId
                  const letters = ['A', 'B', 'C', 'D']
                  return (
                    <tr
                      key={item.clientId}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        verticalAlign: 'top',
                        background:
                          item.status === 'error'
                            ? 'rgba(239, 68, 68, 0.06)'
                            : item.status === 'duplicate'
                            ? 'rgba(245, 158, 11, 0.06)'
                            : undefined,
                      }}
                    >
                      <td style={{ padding: '0.55rem', color: '#94a3b8', fontWeight: 600 }}>{item.index}</td>
                      <td style={{ padding: '0.55rem' }}>
                        {isEditing ? (
                          <textarea
                            rows={3}
                            value={item.question}
                            onChange={(e) => updateItem(item.clientId, { question: e.target.value })}
                            style={{ width: '100%', fontSize: '0.78rem' }}
                          />
                        ) : (
                          <div style={{ whiteSpace: 'pre-wrap' }}>{item.question || <em style={{ color: '#f87171' }}>Missing question</em>}</div>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {letters.map((l, idx) => (
                              <div key={l} style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                <input
                                  type="radio"
                                  name={`bulk_ans_${item.clientId}`}
                                  checked={item.correctAnswer === idx}
                                  onChange={() => updateItem(item.clientId, { correctAnswer: idx })}
                                />
                                <strong style={{ width: '16px' }}>{l})</strong>
                                <input
                                  type="text"
                                  value={item.options[idx]}
                                  onChange={(e) => {
                                    const nextOpts = [...item.options] as [string, string, string, string]
                                    nextOpts[idx] = e.target.value
                                    updateItem(item.clientId, { options: nextOpts })
                                  }}
                                  style={{ flex: 1, fontSize: '0.76rem', padding: '0.25rem 0.4rem' }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.75rem' }}>
                            {letters.map((l, idx) => (
                              <div
                                key={l}
                                style={{
                                  color: item.correctAnswer === idx ? '#34d399' : '#cbd5e1',
                                  fontWeight: item.correctAnswer === idx ? 700 : 400,
                                }}
                              >
                                {l}) {item.options[idx] || <em style={{ color: '#f87171' }}>missing</em>}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem' }}>
                        {item.correctAnswer !== null && item.correctAnswer >= 0 && item.correctAnswer <= 3 ? (
                          <span style={{ color: '#34d399', fontWeight: 700 }}>
                            {letters[item.correctAnswer]}) {item.options[item.correctAnswer]}
                          </span>
                        ) : (
                          <span style={{ color: '#f87171', fontWeight: 600 }}>Missing / Invalid</span>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem' }}>
                        {isEditing ? (
                          <textarea
                            rows={2}
                            value={item.explanation}
                            onChange={(e) => updateItem(item.clientId, { explanation: e.target.value })}
                            style={{ width: '100%', fontSize: '0.76rem' }}
                          />
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                            {item.explanation || <span style={{ color: '#64748b' }}>Auto-filled on upload</span>}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={item.topic}
                            onChange={(e) => updateItem(item.clientId, { topic: e.target.value })}
                            style={{ width: '100%', fontSize: '0.76rem', padding: '0.25rem 0.4rem' }}
                          />
                        ) : (
                          <span style={{ fontSize: '0.75rem' }}>{item.topic}</span>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem' }}>
                        {item.status === 'valid' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#34d399', fontWeight: 700, fontSize: '0.75rem' }}>
                            <CheckCircle2 size={14} /> Valid
                          </span>
                        )}
                        {item.status === 'duplicate' && (
                          <div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#fbbf24', fontWeight: 700, fontSize: '0.75rem' }}>
                              <AlertTriangle size={14} /> Duplicate
                            </span>
                            {item.issues.map((m, idx) => (
                              <div key={idx} style={{ fontSize: '0.7rem', color: '#fde68a', marginTop: '0.15rem' }}>{m}</div>
                            ))}
                          </div>
                        )}
                        {item.status === 'error' && (
                          <div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#f87171', fontWeight: 700, fontSize: '0.75rem' }}>
                              <XCircle size={14} /> Error
                            </span>
                            {item.issues.map((m, idx) => (
                              <div key={idx} style={{ fontSize: '0.7rem', color: '#fca5a5', marginTop: '0.15rem' }}>{m}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.55rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                          <button
                            type="button"
                            onClick={() => setEditingRowId(isEditing ? null : item.clientId)}
                            title={isEditing ? 'Done editing' : 'Edit question'}
                            style={{
                              background: 'rgba(56, 189, 248, 0.14)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              color: '#7dd3fc',
                              borderRadius: '6px',
                              padding: '0.28rem',
                              cursor: 'pointer',
                            }}
                          >
                            {isEditing ? <RefreshCw size={13} /> : <Edit2 size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.clientId)}
                            title="Remove question"
                            style={{
                              background: 'rgba(239, 68, 68, 0.14)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#fca5a5',
                              borderRadius: '6px',
                              padding: '0.28rem',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
