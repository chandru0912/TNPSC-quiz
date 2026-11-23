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
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, getAuthenticatedApiUrl } from '../utils/api'
import { GoogleDrivePdfViewer, type GoogleDriveMaterialItem } from '../components/GoogleDrivePdfViewer'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { useStudentAuth } from '../context/StudentAuthContext'
import { buildAuthRedirectUrl, savePostLoginRedirect } from '../utils/authRedirect'
import './SchoolMaterials.css'

interface TextbookRecord {
  id: number
  standard: number
  subject: string
  medium: 'English' | 'Tamil'
  term: string | null
  volume: string | null
  bookName: string
  fileName?: string
  fileSize?: number
  pageCount?: number
  totalPages?: number
  googleDriveFileId?: string | null
  previewUrl: string
  downloadUrl: string
}

type MediumFilter = 'English' | 'Tamil'

const PREFERRED_SUBJECT_ORDER = [
  'Tamil',
  'English',
  'Mathematics',
  'Science',
  'Social Science',
  'Physics',
  'Chemistry',
  'Biology',
  'Botany',
  'Zoology',
  'History',
  'Geography',
  'Economics',
  'Commerce',
  'Accountancy',
  'Political Science',
  'Computer Science',
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

function formatFileSize(bytes?: number): string {
  const value = Number(bytes || 0)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function groupSortOrder(label: string): number {
  const match = label.match(/(?:term|volume)\s*(\d+)/i)
  if (match) return parseInt(match[1], 10)
  return 99
}

const SchoolMaterials = () => {
  useStudyTimeTracker()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useStudentAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const redirectToLogin = () => {
    const target = `${location.pathname}${location.search}${location.hash}`
    savePostLoginRedirect(target)
    navigate(buildAuthRedirectUrl('login', target), { state: { from: target } })
  }

  const initialStdParam = searchParams.get('standard')
  const initialStd =
    initialStdParam && Number(initialStdParam) >= 6 && Number(initialStdParam) <= 12
      ? Number(initialStdParam)
      : null

  const [selectedStandard, setSelectedStandard] = useState<number | null>(initialStd)
  const [selectedMedium, setSelectedMedium] = useState<MediumFilter>('English')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')
  const [availableTerms, setAvailableTerms] = useState<string[]>([])
  const [availableVolumes, setAvailableVolumes] = useState<string[]>([])
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

  const isHigherSecondary = selectedStandard !== null && selectedStandard >= 11
  const periodLabel = isHigherSecondary ? 'Volume' : 'Term'
  const availablePeriods = isHigherSecondary ? availableVolumes : availableTerms

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
  }, [selectedStandard])

  // Fetch strictly published, Google Drive-backed textbooks for the selected standard
  useEffect(() => {
    if (!selectedStandard) {
      setTextbooks([])
      setAvailableTerms([])
      setAvailableVolumes([])
      setSelectedPeriod('all')
      setLoadError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    setSelectedPeriod('all')

    const loadStandardTextbooks = async () => {
      try {
        const res = await apiFetch(`/api/textbooks/library?standard=${selectedStandard}`)
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || 'Failed to load published textbooks.')
        }

        const payload = json.data || {}
        const rawBooks = Array.isArray(payload.books) ? payload.books : []
        const normalized: TextbookRecord[] = rawBooks.map((r: any) => ({
          id: Number(r.id),
          standard: Number(r.standard),
          subject: normalizeSubjectName(r.subject),
          medium: normalizeMediumName(r.medium),
          term: selectedStandard <= 10 ? (r.term || null) : null,
          volume: selectedStandard >= 11 ? (r.volume || null) : null,
          bookName: r.bookName || r.fileName || `${r.subject} Textbook`,
          fileName: r.fileName || undefined,
          fileSize: Number(r.fileSize) || undefined,
          pageCount: Number(r.pageCount) || undefined,
          totalPages: Number(r.totalPages || r.pageCount) || undefined,
          googleDriveFileId: r.googleDriveFileId || null,
          previewUrl: r.previewUrl || `/api/textbooks/library/${r.id}/preview`,
          downloadUrl: r.downloadUrl || `/api/textbooks/library/${r.id}/download`,
        }))

        if (!cancelled) {
          setTextbooks(normalized)
          setAvailableTerms(Array.isArray(payload.availableTerms) ? payload.availableTerms : [])
          setAvailableVolumes(Array.isArray(payload.availableVolumes) ? payload.availableVolumes : [])
          setIsLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(err?.message || 'Failed to load textbooks from the Google Drive library.')
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

  // Group published textbooks by subject, filtered by selected Medium & Term (6–10) or Volume (11–12)
  const subjectColumns = useMemo(() => {
    const filteredByPeriod = textbooks.filter((tb) => {
      if (selectedPeriod === 'all') return true
      const periodValue = isHigherSecondary ? tb.volume : tb.term
      return periodValue === selectedPeriod
    })

    const subjectSet = new Set<string>()
    for (const tb of filteredByPeriod) {
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
      // Tamil and English are common language subjects visible in both Medium views
      const isCommonSubject = subject === 'Tamil' || subject === 'English'
      const mediumBooks = filteredByPeriod.filter(
        (tb) => tb.subject === subject && (isCommonSubject || tb.medium === selectedMedium)
      )

      const groupMap = new Map<string, TextbookRecord[]>()
      for (const book of mediumBooks) {
        const groupKey = isHigherSecondary
          ? (book.volume || 'Full Textbook')
          : (book.term || 'Full Textbook')
        const list = groupMap.get(groupKey) || []
        list.push(book)
        groupMap.set(groupKey, list)
      }

      const groups = Array.from(groupMap.entries())
        .sort(([a], [b]) => groupSortOrder(a) - groupSortOrder(b) || a.localeCompare(b))
        .map(([groupName, books]) => ({ groupName, books }))

      return {
        subject,
        isCommonSubject,
        totalForMedium: mediumBooks.length,
        groups,
      }
    })
  }, [textbooks, selectedMedium, selectedPeriod, isHigherSecondary])

  const openPdfReader = (book: TextbookRecord) => {
    setViewerMaterial({
      id: book.id,
      fileName: book.fileName || book.bookName,
      subject: book.subject,
      standard: book.standard,
      term: (isHigherSecondary ? book.volume : book.term) || undefined,
      medium: book.medium,
      fileSize: book.fileSize,
      totalPages: book.totalPages || book.pageCount,
      viewUrl: book.previewUrl,
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
              <span>Back to Standards</span>
            </button>

            <div className="library-header-row">
              <div>
                <h1 className="school-title">
                  <GraduationCap size={28} />
                  <span>{`${selectedStandard}th Standard — Textbook Library`}</span>
                </h1>
                <p className="school-subtitle">
                  {isHigherSecondary
                    ? 'Official Samacheer Kalvi Higher Secondary PDFs organized by Volume, Medium & Subject'
                    : 'Official Samacheer Kalvi PDFs organized by Term, Medium & Subject for instant preview & download'}
                </p>
              </div>

              {/* Medium Filter Toggle */}
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

            {/* Dynamic Term (6–10) OR Volume (11–12) Filter Bar */}
            {availablePeriods.length > 0 && (
              <div
                className="medium-filter-bar"
                role="group"
                aria-label={`${periodLabel} filter`}
                style={{ marginTop: '0.85rem', width: 'fit-content', flexWrap: 'wrap' }}
              >
                <span className="medium-filter-label">{periodLabel}:</span>
                <button
                  type="button"
                  className={`medium-filter-btn ${selectedPeriod === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedPeriod('all')}
                >
                  All {periodLabel}s
                </button>
                {availablePeriods.map((period) => (
                  <button
                    key={period}
                    type="button"
                    className={`medium-filter-btn ${selectedPeriod === period ? 'active' : ''}`}
                    onClick={() => setSelectedPeriod(period)}
                  >
                    {period}
                  </button>
                ))}
              </div>
            )}
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
                No published textbooks are currently available for {selectedStandard}th Standard.
              </span>
            </div>
          ) : (
            <>
              <div className="library-summary-strip">
                <span>
                  Showing <strong>{totalVisiblePdfs}</strong> PDF
                  {totalVisiblePdfs === 1 ? '' : 's'} ({selectedMedium} Medium
                  {selectedPeriod !== 'all' ? ` • ${selectedPeriod}` : ''}) across{' '}
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
                      {col.groups.length === 0 ? (
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
                        col.groups.map((group) => (
                          <div key={group.groupName} className="term-group-block">
                            <div className="term-group-heading">{group.groupName}</div>
                            <div className="term-pdf-list">
                              {group.books.map((book) => {
                                const dlUrl = getAuthenticatedApiUrl(book.downloadUrl)
                                const sizeLabel = formatFileSize(book.fileSize)
                                return (
                                  <div key={book.id} className="pdf-item-card">
                                    <div className="pdf-item-info">
                                      <div className="pdf-item-title-row">
                                        <FileText size={16} className="pdf-item-icon" />
                                        <span className="pdf-item-name">{book.bookName}</span>
                                      </div>
                                      <div className="pdf-item-meta">
                                        <span className="pdf-meta-pill">{book.medium} Medium</span>
                                        {sizeLabel ? (
                                          <span className="pdf-meta-pill">{sizeLabel}</span>
                                        ) : null}
                                        {book.totalPages ? (
                                          <span className="pdf-meta-pill">{book.totalPages} Pages</span>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="pdf-item-actions">
                                      <button
                                        type="button"
                                        className="pdf-action-btn pdf-read-btn"
                                        onClick={() => {
                                          if (!isAuthenticated) {
                                            redirectToLogin()
                                            return
                                          }
                                          openPdfReader(book)
                                        }}
                                      >
                                        <Eye size={14} />
                                        <span>Preview</span>
                                      </button>
                                      <a
                                        href={isAuthenticated ? dlUrl : '#'}
                                        download={isAuthenticated ? (book.fileName || `${book.bookName}.pdf`) : undefined}
                                        className="pdf-action-btn pdf-download-btn"
                                        onClick={(e) => {
                                          if (!isAuthenticated) {
                                            e.preventDefault()
                                            redirectToLogin()
                                          }
                                        }}
                                      >
                                        <Download size={14} />
                                        <span>Download</span>
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
            6th to 12th Standard — Select a standard to browse Terms (6th–10th), Volumes (11th–12th), Tamil &amp; English Medium PDFs
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
