import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, getAuthenticatedApiUrl } from '../utils/api'
import { GoogleDrivePdfViewer, type GoogleDriveMaterialItem } from '../components/GoogleDrivePdfViewer'
import { GlassSelect } from '../components/admin/GlassSelect'
import { useStudyTimeTracker } from '../hooks/useStudyTimeTracker'
import { useStudentAuth } from '../context/StudentAuthContext'
import { buildAuthRedirectUrl, savePostLoginRedirect } from '../utils/authRedirect'
import { subscribeStudentSync } from '../utils/studentSync'
import './SchoolMaterials.css'

type MediumFilter = 'English' | 'Tamil'

interface PublishedTextbookCard {
  id: number
  groupId: string
  bookName: string
  standard: number
  subject: string
  medium: 'Tamil' | 'English'
  term: string | null
  volume: string | null
  unit: number | null
  fileName: string
  fileSize: number
  publishedAt: string | null
  downloadCount: number
  previewUrl: string
  downloadUrl: string
}

interface DynamicFilterOptions {
  totalPublished: number
  mediums: Array<{ medium: 'Tamil' | 'English'; count: number }>
  standards: Array<{ standard: number; count: number }>
  subjects: Array<{ subject: string; count: number }>
  terms: Array<{ label: string; count: number }>
  volumes: Array<{ label: string; count: number }>
  structureType: 'term' | 'volume' | 'both' | 'none'
}

function formatFileSize(bytes?: number): string {
  const value = Number(bytes || 0)
  if (!Number.isFinite(value) || value <= 0) return 'PDF'
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
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
  const initialMedParam = searchParams.get('medium')

  const [selectedMedium, setSelectedMedium] = useState<MediumFilter>(
    initialMedParam && initialMedParam.toLowerCase().includes('tamil') ? 'Tamil' : 'English'
  )
  const [selectedStandard, setSelectedStandard] = useState<string>(
    initialStdParam && Number(initialStdParam) >= 6 && Number(initialStdParam) <= 12 ? initialStdParam : 'all'
  )
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedTerm, setSelectedTerm] = useState<string>('all')
  const [selectedVolume, setSelectedVolume] = useState<string>('all')
  const [search, setSearch] = useState<string>('')

  const [filtersMeta, setFiltersMeta] = useState<DynamicFilterOptions>({
    totalPublished: 0,
    mediums: [],
    standards: [],
    subjects: [],
    terms: [],
    volumes: [],
    structureType: 'none',
  })
  const [books, setBooks] = useState<PublishedTextbookCard[]>([])
  const [loadingFilters, setLoadingFilters] = useState(true)
  const [loadingBooks, setLoadingBooks] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [viewerMaterial, setViewerMaterial] = useState<GoogleDriveMaterialItem | null>(null)

  const loadFilters = useCallback(async () => {
    setLoadingFilters(true)
    try {
      const params = new URLSearchParams()
      params.set('medium', selectedMedium)
      if (selectedStandard !== 'all') params.set('standard', selectedStandard)
      if (selectedSubject !== 'all') params.set('subject', selectedSubject)

      const res = await apiFetch(`/api/student/textbooks/filters?${params.toString()}`)
      const json = await res.json().catch(() => null)
      if (res.ok && json?.status === 'success' && json.data) {
        const meta: DynamicFilterOptions = json.data
        setFiltersMeta(meta)

        // Auto-reset any now-invalid cascading selection
        if (selectedStandard !== 'all' && !meta.standards.some((s) => String(s.standard) === selectedStandard)) {
          setSelectedStandard('all')
        }
        if (selectedSubject !== 'all' && !meta.subjects.some((s) => s.subject === selectedSubject)) {
          setSelectedSubject('all')
        }
        if (selectedTerm !== 'all' && !meta.terms.some((t) => t.label === selectedTerm)) {
          setSelectedTerm('all')
        }
        if (selectedVolume !== 'all' && !meta.volumes.some((v) => v.label === selectedVolume)) {
          setSelectedVolume('all')
        }
      }
    } finally {
      setLoadingFilters(false)
    }
  }, [selectedMedium, selectedStandard, selectedSubject, selectedTerm, selectedVolume])

  const loadPublishedBooks = useCallback(async () => {
    setLoadingBooks(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams()
      params.set('medium', selectedMedium)
      if (selectedStandard !== 'all') params.set('standard', selectedStandard)
      if (selectedSubject !== 'all') params.set('subject', selectedSubject)
      if (selectedTerm !== 'all') params.set('term', selectedTerm)
      if (selectedVolume !== 'all') params.set('volume', selectedVolume)
      if (search.trim()) params.set('search', search.trim())
      params.set('limit', '150')

      const res = await apiFetch(`/api/student/textbooks?${params.toString()}`)
      const json = await res.json().catch(() => null)
      if (!res.ok || json?.status !== 'success') {
        throw new Error(json?.message || 'Failed to load published textbooks.')
      }
      setBooks(Array.isArray(json.data) ? json.data : [])
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load Textbook Library.')
    } finally {
      setLoadingBooks(false)
    }
  }, [selectedMedium, selectedStandard, selectedSubject, selectedTerm, selectedVolume, search])

  useEffect(() => {
    void loadFilters()
  }, [loadFilters])

  useEffect(() => {
    void loadPublishedBooks()
  }, [loadPublishedBooks])

  // Real-time refresh whenever Admin publishes/unpublishes a textbook
  useEffect(() => {
    return subscribeStudentSync(() => {
      void loadFilters()
      void loadPublishedBooks()
    })
  }, [loadFilters, loadPublishedBooks])

  const handleMediumChange = (med: MediumFilter) => {
    if (med === selectedMedium) return
    setSelectedMedium(med)
    setSelectedStandard('all')
    setSelectedSubject('all')
    setSelectedTerm('all')
    setSelectedVolume('all')
    setSearchParams({ medium: med })
  }

  const handleStandardChange = (std: string) => {
    setSelectedStandard(std)
    setSelectedSubject('all')
    setSelectedTerm('all')
    setSelectedVolume('all')
    if (std !== 'all') setSearchParams({ medium: selectedMedium, standard: std })
    else setSearchParams({ medium: selectedMedium })
  }

  const handleSubjectChange = (subj: string) => {
    setSelectedSubject(subj)
    setSelectedTerm('all')
    setSelectedVolume('all')
  }

  const clearFilters = () => {
    setSelectedStandard('all')
    setSelectedSubject('all')
    setSelectedTerm('all')
    setSelectedVolume('all')
    setSearch('')
    setSearchParams({ medium: selectedMedium })
  }

  const openPdfReader = (book: PublishedTextbookCard) => {
    setViewerMaterial({
      id: book.id,
      fileName: book.fileName || book.bookName,
      subject: book.subject,
      standard: book.standard,
      term: book.term || book.volume || undefined,
      medium: book.medium,
      fileSize: book.fileSize,
      viewUrl: book.previewUrl,
      downloadUrl: book.downloadUrl,
    })
  }

  const tamilCount = filtersMeta.mediums.find((m) => m.medium === 'Tamil')?.count ?? 0
  const englishCount = filtersMeta.mediums.find((m) => m.medium === 'English')?.count ?? 0
  const hasSecondaryFilters =
    selectedStandard !== 'all' ||
    selectedSubject !== 'all' ||
    selectedTerm !== 'all' ||
    selectedVolume !== 'all' ||
    Boolean(search.trim())

  return (
    <div className="school-materials">
      <div className="school-container">
        <motion.div className="school-header" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <button type="button" className="back-btn" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
            <span>Back to Dashboard</span>
          </button>

          <div className="library-header-row" style={{ alignItems: 'center' }}>
            <div>
              <h1 className="school-title">
                <GraduationCap size={30} />
                <span>
                  Samacheer Kalvi <span className="gradient-text">Textbook Library</span>
                </span>
              </h1>
              <p className="school-subtitle">
                Official published TNPSC school textbooks — filter by Medium, Standard (6th–12th), Subject, and Term / Volume
              </p>
            </div>

            {/* A. Clear Medium Selection (Strictly Separated Tamil vs English Medium) */}
            <div className="medium-filter-bar" role="group" aria-label="Select Textbook Medium">
              <button
                type="button"
                className={`medium-filter-btn ${selectedMedium === 'Tamil' ? 'active' : ''}`}
                onClick={() => handleMediumChange('Tamil')}
              >
                Tamil Medium {tamilCount > 0 ? `(${tamilCount})` : ''}
              </button>
              <button
                type="button"
                className={`medium-filter-btn ${selectedMedium === 'English' ? 'active' : ''}`}
                onClick={() => handleMediumChange('English')}
              >
                English Medium {englishCount > 0 ? `(${englishCount})` : ''}
              </button>
            </div>
          </div>
        </motion.div>

        {/* B. Dynamic Standard Pills (Only standards that have published textbooks for selected medium) */}
        {filtersMeta.standards.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.1rem' }}>
            <button
              type="button"
              className={`medium-filter-btn ${selectedStandard === 'all' ? 'active' : ''}`}
              onClick={() => handleStandardChange('all')}
            >
              All Standards ({selectedMedium === 'Tamil' ? tamilCount : englishCount})
            </button>
            {filtersMeta.standards.map((s) => (
              <button
                key={s.standard}
                type="button"
                className={`medium-filter-btn ${selectedStandard === String(s.standard) ? 'active' : ''}`}
                onClick={() => handleStandardChange(String(s.standard))}
              >
                {s.standard}th Standard ({s.count})
              </button>
            ))}
          </div>
        )}

        {/* C & D. Cascading Glassmorphism Filters (Subject, Term / Volume, Search) */}
        <div
          className="glass"
          style={{
            padding: '1rem 1.2rem',
            borderRadius: '14px',
            border: '1px solid rgba(148,163,184,0.18)',
            marginBottom: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.85rem',
            alignItems: 'end',
          }}
        >
          <div className="glass-select-root">
            <span className="glass-select-label">
              <Search size={12} /> <span>Search Textbooks</span>
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search textbook title or subject..."
              style={{
                width: '100%',
                height: '42px',
                padding: '0 0.85rem',
                borderRadius: '11px',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(148, 163, 184, 0.24)',
                color: '#f8fafc',
                fontSize: '0.84rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <GlassSelect
            label="Subject"
            icon={<BookOpen size={12} />}
            value={selectedSubject}
            loading={loadingFilters}
            onChange={handleSubjectChange}
            options={[
              { value: 'all', label: 'All Available Subjects' },
              ...filtersMeta.subjects.map((s) => ({ value: s.subject, label: s.subject, count: s.count })),
            ]}
          />

          {(filtersMeta.structureType === 'term' || filtersMeta.structureType === 'both') && (
            <GlassSelect
              label="Term"
              icon={<Layers size={12} />}
              value={selectedTerm}
              loading={loadingFilters}
              onChange={(v) => { setSelectedTerm(v); setSelectedVolume('all') }}
              options={[
                { value: 'all', label: 'All Terms' },
                ...filtersMeta.terms.map((t) => ({ value: t.label, label: t.label, count: t.count })),
              ]}
            />
          )}

          {(filtersMeta.structureType === 'volume' || filtersMeta.structureType === 'both') && (
            <GlassSelect
              label="Volume"
              icon={<Layers size={12} />}
              value={selectedVolume}
              loading={loadingFilters}
              onChange={(v) => { setSelectedVolume(v); setSelectedTerm('all') }}
              options={[
                { value: 'all', label: 'All Volumes' },
                ...filtersMeta.volumes.map((v) => ({ value: v.label, label: v.label, count: v.count })),
              ]}
            />
          )}

          {hasSecondaryFilters && (
            <button
              type="button"
              className="medium-filter-btn"
              style={{ height: '42px', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={clearFilters}
            >
              <X size={14} /> Clear Filters
            </button>
          )}
        </div>

        {/* E. Published Textbook Cards */}
        {loadingBooks ? (
          <div className="library-state-card glass">
            <Loader2 size={32} className="spin" style={{ color: 'var(--gold-primary)' }} />
            <span>Loading published {selectedMedium} Medium textbooks...</span>
          </div>
        ) : loadError ? (
          <div className="library-state-card glass library-error">
            <AlertCircle size={28} />
            <span>{loadError}</span>
          </div>
        ) : books.length === 0 ? (
          <div className="library-state-card glass">
            <BookMarked size={32} style={{ color: 'var(--gold-primary)' }} />
            <span>
              No published textbooks are currently available for <strong>{selectedMedium} Medium</strong>
              {selectedStandard !== 'all' ? ` • ${selectedStandard}th Standard` : ''}.
            </span>
          </div>
        ) : (
          <>
            <div className="library-summary-strip">
              <span>
                Showing <strong>{books.length}</strong> published{' '}
                <strong>{selectedMedium === 'Tamil' ? 'தமிழ் வழி (Tamil Medium)' : 'English Medium'}</strong>{' '}
                textbook{books.length === 1 ? '' : 's'}
                {selectedStandard !== 'all' ? ` • ${selectedStandard}th Standard` : ''}
                {selectedSubject !== 'all' ? ` • ${selectedSubject}` : ''}
                {selectedTerm !== 'all' ? ` • ${selectedTerm}` : ''}
                {selectedVolume !== 'all' ? ` • ${selectedVolume}` : ''}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: '1rem',
              }}
            >
              {books.map((book) => {
                const dlUrl = getAuthenticatedApiUrl(book.downloadUrl)
                const periodBadge = book.volume || book.term
                return (
                  <motion.article
                    key={book.id}
                    className="pdf-item-card glass"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.85rem',
                      padding: '1.1rem',
                      borderRadius: '14px',
                      border: '1px solid rgba(148,163,184,0.18)',
                    }}
                  >
                    <div className="pdf-item-info">
                      <div className="pdf-item-title-row" style={{ alignItems: 'flex-start', gap: '0.55rem' }}>
                        <FileText size={18} className="pdf-item-icon" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span className="pdf-item-name" style={{ fontSize: '0.94rem', fontWeight: 700, lineHeight: 1.35 }}>
                          {book.bookName}
                        </span>
                      </div>

                      <div className="pdf-item-meta" style={{ marginTop: '0.6rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        <span className="pdf-meta-pill">{book.standard}th Standard</span>
                        <span className="pdf-meta-pill">{book.subject}</span>
                        <span className="pdf-meta-pill">{book.medium === 'Tamil' ? 'தமிழ் வழி' : 'English Medium'}</span>
                        {periodBadge && <span className="pdf-meta-pill">{periodBadge}</span>}
                        <span className="pdf-meta-pill">{formatFileSize(book.fileSize)}</span>
                        <span
                          className="pdf-meta-pill"
                          style={{ background: 'rgba(16,185,129,0.16)', color: '#34d399', borderColor: 'rgba(52,211,153,0.35)' }}
                        >
                          <CheckCircle2 size={11} style={{ marginRight: '3px', verticalAlign: '-1px' }} /> Published
                        </span>
                      </div>
                    </div>

                    <div className="pdf-item-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="pdf-action-btn pdf-read-btn"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => {
                          if (!isAuthenticated) {
                            redirectToLogin()
                            return
                          }
                          openPdfReader(book)
                        }}
                      >
                        <Eye size={14} />
                        <span>View PDF</span>
                      </button>
                      <a
                        href={isAuthenticated ? dlUrl : '#'}
                        download={isAuthenticated ? (book.fileName || `${book.bookName}.pdf`) : undefined}
                        className="pdf-action-btn pdf-download-btn"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={(e) => {
                          if (!isAuthenticated) {
                            e.preventDefault()
                            redirectToLogin()
                          }
                        }}
                      >
                        <Download size={14} />
                        <span>Download PDF</span>
                      </a>
                    </div>
                  </motion.article>
                )
              })}
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

export default SchoolMaterials
