import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  ArrowLeft,
  FileText,
  Download,
  Eye,
  Loader2,
  AlertCircle,
  BookMarked,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, getApiUrl } from '../utils/api'
import { useLanguage } from '../context/LanguageContext'
import { GoogleDrivePdfViewer, type GoogleDriveMaterialItem } from '../components/GoogleDrivePdfViewer'
import './SchoolMaterials.css'

interface TextbookRecord {
  id: number
  standard: number
  subject: string
  medium: string
  term: string | null
  bookName: string
  fileSize?: number
  pageCount?: number
  totalPages?: number
  status?: string
  googleDriveFileId?: string | null
  viewUrl?: string
  downloadUrl?: string
  sourceType: 'textbook' | 'drive'
}

type MediumFilter = 'English' | 'Tamil'

const PREFERRED_SUBJECT_ORDER = [
  'Tamil',
  'English',
  'Mathematics',
  'Science',
  'Social Science',
]

function normalizeSubjectName(raw?: string): string {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return 'General'
  const lower = trimmed.toLowerCase()
  if (lower === 'maths' || lower === 'mathematics') return 'Mathematics'
  if (lower === 'social' || lower === 'social science' || lower === 'social studies') return 'Social Science'
  if (lower === 'tamil' || lower === 'general tamil') return 'Tamil'
  if (lower === 'english' || lower === 'general english') return 'English'
  if (lower === 'science') return 'Science'
  return trimmed
}

function normalizeMediumName(raw?: string): MediumFilter {
  return String(raw || '').toLowerCase().includes('tamil') ? 'Tamil' : 'English'
}

function normalizeTermLabel(raw?: string | null): string {
  const s = String(raw || '').trim()
  if (!s || /^not applicable$/i.test(s) || /^n\/a$/i.test(s)) return 'Full Textbook'
  const match = s.match(/term\s*[-:]?\s*(\d+)/i)
  if (match) return `Term ${match[1]}`
  return s
}

function termSortOrder(termLabel: string): number {
  const match = termLabel.match(/term\s*(\d+)/i)
  if (match) return parseInt(match[1], 10)
  return 99
}

function isTextbookEnabled(status?: string): boolean {
  const s = String(status || '').toLowerCase().trim()
  return !['disabled', 'deleted', 'inactive', 'archived', 'rejected'].includes(s)
}

const SchoolMaterials = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isTamil } = useLanguage()

  const initialStdParam = searchParams.get('standard')
  const initialStd =
    initialStdParam && Number(initialStdParam) >= 6 && Number(initialStdParam) <= 12
      ? Number(initialStdParam)
      : null

  const [selectedStandard, setSelectedStandard] = useState<number | null>(initialStd)
  const [selectedMedium, setSelectedMedium] = useState<MediumFilter>('English')
  const [textbooks, setTextbooks] = useState<TextbookRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewerMaterial, setViewerMaterial] = useState<GoogleDriveMaterialItem | null>(null)

  const standards = [
    { id: 6, name: '6th Standard' },
    { id: 7, name: '7th Standard' },
    { id: 8, name: '8th Standard' },
    { id: 9, name: '9th Standard' },
    { id: 10, name: '10th Standard' },
    { id: 11, name: '11th Standard' },
    { id: 12, name: '12th Standard' },
  ]

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
  }, [selectedStandard])

  // Fetch all textbooks for selected Standard from Textbook Management APIs
  useEffect(() => {
    if (!selectedStandard) {
      setTextbooks([])
      setLoadError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)

    const loadStandardTextbooks = async () => {
      try {
        const [tbRes, driveRes] = await Promise.all([
          apiFetch(`/api/textbooks?standard=${selectedStandard}`).catch(() => null),
          apiFetch(`/api/drive/materials?standard=${selectedStandard}`).catch(() => null),
        ])

        const combined: TextbookRecord[] = []
        const seenDriveIds = new Set<string>()
        const seenSignatures = new Set<string>()

        const addRecord = (rec: TextbookRecord) => {
          if (Number(rec.standard) !== selectedStandard) return
          if (!isTextbookEnabled(rec.status)) return

          const normSub = normalizeSubjectName(rec.subject)
          const normMed = normalizeMediumName(rec.medium)
          const normTerm = normalizeTermLabel(rec.term)
          const sig = `${rec.standard}__${normSub.toLowerCase()}__${normMed.toLowerCase()}__${normTerm.toLowerCase()}__${rec.bookName.trim().toLowerCase()}`

          if (rec.googleDriveFileId && seenDriveIds.has(rec.googleDriveFileId)) return
          if (seenSignatures.has(sig)) return

          if (rec.googleDriveFileId) seenDriveIds.add(rec.googleDriveFileId)
          seenSignatures.add(sig)

          combined.push({
            ...rec,
            subject: normSub,
            medium: normMed,
            term: normTerm,
          })
        }

        if (tbRes && tbRes.ok) {
          const tbJson = await tbRes.json().catch(() => null)
          const rows = Array.isArray(tbJson?.data) ? tbJson.data : []
          for (const r of rows) {
            addRecord({
              id: Number(r.id),
              standard: Number(r.standard),
              subject: r.subject,
              medium: r.medium,
              term: r.term || null,
              bookName: r.bookName || `${r.subject} ${r.term || ''}`.trim(),
              fileSize: Number(r.fileSize) || undefined,
              pageCount: Number(r.pageCount) || undefined,
              totalPages: Number(r.totalPages || r.pageCount) || undefined,
              status: r.status,
              googleDriveFileId: r.googleDriveFileId || null,
              viewUrl: r.viewUrl || `/api/textbooks/${r.id}/view`,
              downloadUrl: r.downloadUrl || `/api/textbooks/${r.id}/download`,
              sourceType: 'textbook',
            })
          }
        }

        // Also include any active Google Drive materials not yet mirrored in textbooks table
        if (driveRes && driveRes.ok) {
          const driveJson = await driveRes.json().catch(() => null)
          const driveRows = Array.isArray(driveJson?.materials)
            ? driveJson.materials
            : Array.isArray(driveJson?.data)
            ? driveJson.data
            : []
          for (const m of driveRows) {
            if (String(m.uploadStatus || 'ACTIVE').toUpperCase() === 'DELETED') continue
            addRecord({
              id: Number(m.id),
              standard: Number(m.standard),
              subject: m.subject,
              medium: m.medium,
              term: m.term || null,
              bookName: m.fileName || m.originalFileName || `${m.subject} ${m.term || ''}`.trim(),
              fileSize: Number(m.fileSize) || undefined,
              totalPages: Number(m.totalPages) || undefined,
              status: m.uploadStatus || 'active',
              googleDriveFileId: m.googleDriveFileId || m.driveFileId || null,
              viewUrl: m.viewUrl || `/api/drive/view/${m.id}`,
              downloadUrl: m.viewUrl || `/api/drive/view/${m.id}`,
              sourceType: 'drive',
            })
          }
        }

        if (!cancelled) {
          setTextbooks(combined)
          setIsLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message || 'Failed to load textbooks from Textbook Management.')
          setIsLoading(false)
        }
      }
    }

    void loadStandardTextbooks()
    return () => {
      cancelled = true
    }
  }, [selectedStandard])

  const handleSelectStandard = (stdId: number) => {
    setSelectedStandard(stdId)
    setSearchParams({ standard: String(stdId) })
  }

  const handleBack = () => {
    if (selectedStandard !== null) {
      setSelectedStandard(null)
      setSearchParams({})
    } else {
      navigate('/materials')
    }
  }

  // Group all subjects available for the selected standard into separate columns
  const subjectColumns = useMemo(() => {
    const subjectSet = new Set<string>()
    for (const tb of textbooks) {
      subjectSet.add(tb.subject)
    }

    const orderedSubjects = Array.from(subjectSet).sort((a, b) => {
      const idxA = PREFERRED_SUBJECT_ORDER.indexOf(a)
      const idxB = PREFERRED_SUBJECT_ORDER.indexOf(b)
      if (idxA !== -1 && idxB !== -1) return idxA - idxB
      if (idxA !== -1) return -1
      if (idxB !== -1) return 1
      return a.localeCompare(b)
    })

    return orderedSubjects.map((subject) => {
      // Tamil and English are common subjects independent of the selected textbook medium:
      // always show all available Tamil and English textbook PDFs in both English & Tamil Medium views.
      const isCommonSubject = subject === 'Tamil' || subject === 'English'
      const mediumBooks = textbooks.filter(
        (tb) => tb.subject === subject && (isCommonSubject || tb.medium === selectedMedium)
      )

      const termMap = new Map<string, TextbookRecord[]>()
      for (const book of mediumBooks) {
        const termKey = book.term || 'Full Textbook'
        const list = termMap.get(termKey) || []
        list.push(book)
        termMap.set(termKey, list)
      }

      const terms = Array.from(termMap.entries())
        .sort(([a], [b]) => termSortOrder(a) - termSortOrder(b) || a.localeCompare(b))
        .map(([termName, books]) => ({ termName, books }))

      return {
        subject,
        isCommonSubject,
        totalForMedium: mediumBooks.length,
        terms,
      }
    })
  }, [textbooks, selectedMedium])

  const openPdfReader = (book: TextbookRecord) => {
    setViewerMaterial({
      id: book.id,
      fileName: book.bookName,
      subject: book.subject,
      standard: book.standard,
      term: book.term || undefined,
      medium: book.medium,
      fileSize: book.fileSize,
      totalPages: book.totalPages || book.pageCount,
      viewUrl: book.viewUrl,
      downloadUrl: book.downloadUrl,
    })
  }

  if (selectedStandard !== null) {
    const totalVisiblePdfs = subjectColumns.reduce((acc, col) => acc + col.totalForMedium, 0)

    return (
      <div className="school-materials">
        <div className="school-container">
          <motion.div
            className="school-header"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button type="button" className="back-btn" onClick={handleBack}>
              <ArrowLeft size={20} />
              <span>{isTamil ? 'வகுப்புகளுக்குத் திரும்பு' : 'Back to Standards'}</span>
            </button>

            <div className="library-header-row">
              <div>
                <h1 className="school-title">
                  <GraduationCap size={28} />
                  <span>
                    {isTamil
                      ? `${selectedStandard}-ஆம் வகுப்பு பாடநூல் நூலகம்`
                      : `${selectedStandard}th Standard — Textbook Library`}
                  </span>
                </h1>
                <p className="school-subtitle">
                  {isTamil
                    ? 'பாடம் மற்றும் பருவம் வாரியாக சமச்சீர் கல்வி பாடநூல் PDF-களைப் படிக்கவும் அல்லது பதிவிறக்கவும்'
                    : 'All available subjects displayed side-by-side with Term-wise PDFs for instant reading & download'}
                </p>
              </div>

              {/* Top Medium Filter Toggle */}
              <div className="medium-filter-bar" role="group" aria-label="Medium filter">
                <span className="medium-filter-label">Medium:</span>
                <button
                  type="button"
                  className={`medium-filter-btn ${selectedMedium === 'English' ? 'active' : ''}`}
                  onClick={() => setSelectedMedium('English')}
                >
                  English Medium
                </button>
                <button
                  type="button"
                  className={`medium-filter-btn ${selectedMedium === 'Tamil' ? 'active' : ''}`}
                  onClick={() => setSelectedMedium('Tamil')}
                >
                  Tamil Medium
                </button>
              </div>
            </div>
          </motion.div>

          {isLoading ? (
            <div className="library-state-card glass">
              <Loader2 size={32} className="spin" style={{ color: 'var(--gold-primary)' }} />
              <span>Loading {selectedStandard}th Standard textbooks...</span>
            </div>
          ) : loadError ? (
            <div className="library-state-card glass library-error">
              <AlertCircle size={28} />
              <span>{loadError}</span>
            </div>
          ) : subjectColumns.length === 0 ? (
            <div className="library-state-card glass">
              <BookMarked size={32} style={{ color: 'var(--gold-primary)' }} />
              <span>
                No textbooks are currently registered for {selectedStandard}th Standard in Textbook Management.
              </span>
            </div>
          ) : (
            <>
              <div className="library-summary-strip">
                <span>
                  Showing <strong>{totalVisiblePdfs}</strong> PDF
                  {totalVisiblePdfs === 1 ? '' : 's'} ({selectedMedium} Medium + Common Tamil &amp; English) across{' '}
                  <strong>{subjectColumns.length}</strong> subject
                  {subjectColumns.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="subject-columns-grid">
                {subjectColumns.map((col, idx) => (
                  <motion.section
                    key={col.subject}
                    className="subject-column-card glass"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <header className="subject-column-header">
                      <div className="subject-column-title-wrap">
                        <div className="subject-icon">
                          <BookOpen size={20} />
                        </div>
                        <div>
                          <h2 className="subject-column-title">{col.subject}</h2>
                          <span className="subject-column-count">
                            {col.isCommonSubject
                              ? `${col.totalForMedium} Common ${col.subject} PDF${col.totalForMedium === 1 ? '' : 's'}`
                              : `${col.totalForMedium} ${selectedMedium} Medium PDF${col.totalForMedium === 1 ? '' : 's'}`}
                          </span>
                        </div>
                      </div>
                    </header>

                    <div className="subject-column-body">
                      {col.terms.length === 0 ? (
                        <div className="subject-empty-medium">
                          {col.isCommonSubject ? (
                            `No ${col.subject} textbook PDFs available for this standard yet.`
                          ) : (
                            <>
                              No {selectedMedium} Medium PDFs available for {col.subject}.
                              <br />
                              Switch to {selectedMedium === 'English' ? 'Tamil' : 'English'} Medium above to view available PDFs.
                            </>
                          )}
                        </div>
                      ) : (
                        col.terms.map((termGroup) => (
                          <div key={termGroup.termName} className="term-group-block">
                            <div className="term-group-heading">{termGroup.termName}</div>
                            <div className="term-pdf-list">
                              {termGroup.books.map((book) => {
                                const dlUrl = getApiUrl(book.downloadUrl || book.viewUrl || '')
                                return (
                                  <div key={`${book.sourceType}-${book.id}`} className="pdf-item-card">
                                    <div className="pdf-item-info">
                                      <div className="pdf-item-title-row">
                                        <FileText size={16} className="pdf-item-icon" />
                                        <span className="pdf-item-name">{book.bookName}</span>
                                      </div>
                                      <div className="pdf-item-meta">
                                        <span className="pdf-meta-pill">{book.medium} Medium</span>
                                        {book.totalPages ? (
                                          <span className="pdf-meta-pill">{book.totalPages} Pages</span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="pdf-item-actions">
                                      <button
                                        type="button"
                                        className="pdf-action-btn pdf-read-btn"
                                        onClick={() => openPdfReader(book)}
                                      >
                                        <Eye size={14} />
                                        <span>Read PDF</span>
                                      </button>
                                      <a
                                        href={dlUrl}
                                        download={book.bookName}
                                        className="pdf-action-btn pdf-download-btn"
                                      >
                                        <Download size={14} />
                                        <span>Download PDF</span>
                                      </a>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.section>
                ))}
              </div>
            </>
          )}
        </div>

        <GoogleDrivePdfViewer
          isOpen={Boolean(viewerMaterial)}
          onClose={() => setViewerMaterial(null)}
          material={viewerMaterial}
        />
      </div>
    )
  }

  return (
    <div className="school-materials">
      <div className="school-container">
        <motion.div className="school-header" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button type="button" className="back-btn" onClick={() => navigate('/materials')}>
            <ArrowLeft size={20} />
            <span>Back to TNPSC Materials</span>
          </button>
          <h1 className="school-title">
            <GraduationCap size={32} />
            <span>
              Class-Wise <span className="gradient-text">Textbook Library</span>
            </span>
          </h1>
          <p className="school-subtitle">
            6th to 12th Standard — Select a standard to view all subjects, terms, Tamil &amp; English Medium PDFs
          </p>
        </motion.div>

        <div className="standards-grid">
          {standards.map((standard, index) => (
            <motion.div
              key={standard.id}
              className="standard-card glass"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.04 }}
              onClick={() => handleSelectStandard(standard.id)}
            >
              <div className="standard-number">{standard.id}</div>
              <div className="standard-name">{standard.name}</div>
              <ChevronRight size={24} className="standard-arrow" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SchoolMaterials
