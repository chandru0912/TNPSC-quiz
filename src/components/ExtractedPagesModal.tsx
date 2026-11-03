import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  FileText,
  Search,
  Zap,
} from 'lucide-react'
import { apiFetch } from '../utils/api'
import { useScrollLock } from '../hooks/useScrollLock'

export interface ExtractedPageItem {
  pageNumber: number
  text: string
  unitId?: number
  unitTitle?: string
  lessonTitle?: string
  topic?: string
  fileName?: string
  pdfId?: number
  materialId?: number
  standard?: number
  subject?: string
  term?: string
  isOcr: boolean
  extractionMethod?: string
  ocrConfidence?: number | null
  status?: string
}

export interface ExtractedPagesResponse {
  totalPages: number
  fileName?: string
  pdfId?: number
  materialId?: number
  standard?: number
  subject?: string
  term?: string
  pdfType?: string
  status?: string
  nativePages?: number
  ocrPages?: number
  failedPages?: number
  pages: ExtractedPageItem[]
}

export interface ExtractedPagesModalProps {
  isOpen: boolean
  onClose: () => void
  material?: {
    id: number
    fileName: string
    standard?: number | string
    subject?: string
    term?: string
    [key: string]: any
  } | null
  materialId?: number | null
  initialFileName?: string
  initialStandard?: number | string
  initialSubject?: string
  initialTerm?: string
  onExtractionTriggered?: () => void
  onExtractionFinished?: () => void
}

export const ExtractedPagesModal: React.FC<ExtractedPagesModalProps> = ({
  isOpen,
  onClose,
  material,
  materialId,
  initialFileName,
  initialStandard,
  initialSubject,
  initialTerm,
  onExtractionTriggered,
  onExtractionFinished,
}) => {
  useScrollLock(isOpen)

  const effectiveMaterialId = material?.id ?? materialId ?? null
  const effectiveFileName = material?.fileName ?? initialFileName
  const effectiveStandard = material?.standard ?? initialStandard
  const effectiveSubject = material?.subject ?? initialSubject
  const effectiveTerm = material?.term ?? initialTerm

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ExtractedPagesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractMessage, setExtractMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !effectiveMaterialId) {
      setData(null)
      setError(null)
      setCurrentPage(1)
      setSearchQuery('')
      setExtractMessage(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    const token = localStorage.getItem('tnpsc_admin_token') || ''
    apiFetch(`/api/drive/materials/${effectiveMaterialId}/extracted-pages`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        const json = await res.json()
        if (!isMounted) return
        if (res.ok && json.status === 'success' && json.data) {
          setData(json.data)
          setCurrentPage(1)
        } else {
          setError(json.message || 'No extracted text found for this PDF.')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err.message || 'Failed to load extracted pages.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, effectiveMaterialId])

  const handleTriggerExtract = async (retryFailedOnly = false) => {
    if (!effectiveMaterialId) return
    setIsExtracting(true)
    setExtractMessage(null)
    const token = localStorage.getItem('tnpsc_admin_token') || ''

    try {
      const endpoint = retryFailedOnly
        ? `/api/drive/materials/${effectiveMaterialId}/retry-failed?all=true`
        : `/api/drive/materials/${effectiveMaterialId}/extract?all=true`

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const json = await res.json()
      if (res.ok && (json.status === 'success' || json.data?.success)) {
        setExtractMessage(json.message || 'Extraction completed successfully!')
        onExtractionTriggered?.()
        onExtractionFinished?.()
        // Reload pages
        const pagesRes = await apiFetch(`/api/drive/materials/${effectiveMaterialId}/extracted-pages`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const pagesJson = await pagesRes.json()
        if (pagesJson.status === 'success' && pagesJson.data) {
          setData(pagesJson.data)
        }
      } else {
        setExtractMessage(json.message || 'Extraction could not be completed.')
      }
    } catch (err: any) {
      setExtractMessage(err.message || 'Failed to trigger extraction.')
    } finally {
      setIsExtracting(false)
    }
  }

  const pages = data?.pages || []
  const totalPages = data?.totalPages || pages.length

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return pages
    const q = searchQuery.toLowerCase()
    return pages.filter(
      (p) =>
        p.text.toLowerCase().includes(q) ||
        (p.lessonTitle && p.lessonTitle.toLowerCase().includes(q)) ||
        (p.unitTitle && p.unitTitle.toLowerCase().includes(q)) ||
        `page ${p.pageNumber}`.includes(q)
    )
  }, [pages, searchQuery])

  const activePageItem = useMemo(() => {
    return pages.find((p) => p.pageNumber === currentPage) || pages[0] || null
  }, [pages, currentPage])

  const handleCopyText = () => {
    if (!activePageItem?.text) return
    navigator.clipboard.writeText(activePageItem.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1050px',
          maxHeight: '92vh',
          background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(234, 179, 8, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fbbf24',
                }}
              >
                <BookOpen size={18} />
              </div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '550px',
                }}
                title={data?.fileName || effectiveFileName || 'Extracted Text Viewer'}
              >
                {data?.fileName || effectiveFileName || 'Extracted Text Viewer'}
              </h2>
              {data?.pdfId && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                  }}
                >
                  PDF ID: {data.pdfId}
                </span>
              )}
            </div>

            {/* Metadata Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#93c5fd',
                  fontWeight: 600,
                }}
              >
                Class {data?.standard || effectiveStandard}th
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fcd34d',
                  fontWeight: 600,
                }}
              >
                {data?.subject || effectiveSubject || 'General Studies'}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(168, 85, 247, 0.2)',
                  color: '#d8b4fe',
                  fontWeight: 600,
                }}
              >
                {data?.term || effectiveTerm || 'Term 1'}
              </span>
              {data?.status && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background:
                      data.status === 'COMPLETED'
                        ? 'rgba(34, 197, 94, 0.2)'
                        : data.status === 'FAILED'
                        ? 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(245, 158, 11, 0.2)',
                    color:
                      data.status === 'COMPLETED'
                        ? '#86efac'
                        : data.status === 'FAILED'
                        ? '#fca5a5'
                        : '#fde047',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {data.status === 'COMPLETED' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                  {data.status}
                </span>
              )}
              {totalPages > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                  Total: {totalPages} page{totalPages === 1 ? '' : 's'}
                  {data?.nativePages ? ` • ${data.nativePages} Native` : ''}
                  {data?.ocrPages ? ` • ${data.ocrPages} OCR` : ''}
                  {data?.failedPages ? ` • ${data.failedPages} Failed` : ''}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '0.45rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action / Extract Notification */}
        {extractMessage && (
          <div
            style={{
              padding: '0.65rem 1.25rem',
              background: 'rgba(34, 197, 94, 0.15)',
              borderBottom: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#86efac',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <CheckCircle size={14} />
            <span>{extractMessage}</span>
          </div>
        )}

        {/* Modal Body */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                gap: '1rem',
              }}
            >
              <RefreshCw size={28} className="spinning" style={{ color: '#fbbf24' }} />
              <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Loading extracted pages from database...</div>
            </div>
          ) : error || pages.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1.5rem',
                textAlign: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fbbf24',
                }}
              >
                <FileText size={28} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#ffffff' }}>PDF Text Not Extracted Yet</h3>
              <p style={{ margin: 0, maxWidth: '460px', fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.5' }}>
                This textbook PDF has not been processed through the automatic page-by-page text extraction pipeline yet.
                Click the button below to extract every page and store it in PostgreSQL.
              </p>
              <button
                type="button"
                onClick={() => handleTriggerExtract(false)}
                disabled={isExtracting}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ffd700 100%)',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.65rem 1.25rem',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: isExtracting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)',
                  marginTop: '0.5rem',
                }}
              >
                {isExtracting ? (
                  <>
                    <RefreshCw size={16} className="spinning" />
                    <span>Extracting All Pages Now...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>Extract All Pages Now</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
              {/* Left Sidebar: Page List & Search */}
              <div
                style={{
                  width: '260px',
                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'rgba(15, 23, 42, 0.4)',
                }}
              >
                {/* Search Bar */}
                <div style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <div
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Search size={14} style={{ position: 'absolute', left: '0.65rem', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search within pages..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.65rem 0.4rem 2rem',
                        fontSize: '0.8rem',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Page Navigation Thumbnails List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                  {filteredPages.map((page) => {
                    const isActive = page.pageNumber === currentPage
                    return (
                      <button
                        key={page.pageNumber}
                        type="button"
                        onClick={() => setCurrentPage(page.pageNumber)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.55rem 0.75rem',
                          borderRadius: '6px',
                          border: isActive ? '1px solid #fbbf24' : '1px solid transparent',
                          background: isActive
                            ? 'rgba(234, 179, 8, 0.12)'
                            : 'rgba(255, 255, 255, 0.02)',
                          color: isActive ? '#fef08a' : '#cbd5e1',
                          cursor: 'pointer',
                          marginBottom: '0.3rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>
                            Page {page.pageNumber}
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background:
                                page.status === 'failed'
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : page.isOcr
                                  ? 'rgba(168, 85, 247, 0.2)'
                                  : 'rgba(34, 197, 94, 0.2)',
                              color:
                                page.status === 'failed'
                                  ? '#fca5a5'
                                  : page.isOcr
                                  ? '#d8b4fe'
                                  : '#86efac',
                            }}
                          >
                            {page.status === 'failed' ? 'Failed' : page.isOcr ? 'OCR' : 'Native'}
                          </span>
                        </div>
                        {page.lessonTitle && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: 'rgba(255, 255, 255, 0.5)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {page.lessonTitle}
                          </span>
                        )}
                        <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.4)' }}>
                          {page.text ? `${page.text.length} chars` : '0 chars'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Main Content View: Active Page Reader */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {activePageItem ? (
                  <>
                    {/* Active Page Bar */}
                    <div
                      style={{
                        padding: '0.75rem 1.25rem',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(15, 23, 42, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fef08a' }}>
                          Page {activePageItem.pageNumber} of {totalPages}
                        </span>
                        {activePageItem.unitTitle && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              background: 'rgba(255, 255, 255, 0.08)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              color: '#cbd5e1',
                            }}
                          >
                            Unit: {activePageItem.unitTitle}
                          </span>
                        )}
                        {activePageItem.lessonTitle && (
                          <span
                            style={{
                              fontSize: '0.74rem',
                              background: 'rgba(192, 132, 252, 0.15)',
                              color: '#d8b4fe',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            Lesson: {activePageItem.lessonTitle}
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: activePageItem.isOcr
                              ? 'rgba(168, 85, 247, 0.2)'
                              : 'rgba(34, 197, 94, 0.2)',
                            color: activePageItem.isOcr ? '#d8b4fe' : '#86efac',
                            fontWeight: 600,
                          }}
                        >
                          {activePageItem.isOcr ? '🔍 OCR Extracted' : '📄 Native PDF Text'}
                        </span>
                      </div>

                      {/* Pagination & Copy Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage <= 1}
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: 'none',
                            color: currentPage <= 1 ? 'rgba(255, 255, 255, 0.25)' : '#ffffff',
                            borderRadius: '6px',
                            padding: '0.35rem 0.65rem',
                            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '0.78rem',
                          }}
                        >
                          <ChevronLeft size={14} />
                          <span>Prev</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: 'none',
                            color: currentPage >= totalPages ? 'rgba(255, 255, 255, 0.25)' : '#ffffff',
                            borderRadius: '6px',
                            padding: '0.35rem 0.65rem',
                            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '0.78rem',
                          }}
                        >
                          <span>Next</span>
                          <ChevronRight size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={handleCopyText}
                          style={{
                            background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                            border: copied ? '1px solid rgba(34, 197, 94, 0.4)' : 'none',
                            color: copied ? '#86efac' : '#ffffff',
                            borderRadius: '6px',
                            padding: '0.35rem 0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                          }}
                          title="Copy this page's text"
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copied ? 'Copied' : 'Copy Text'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Extracted Page Text Content Display */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '1.25rem 1.5rem',
                        fontSize: '0.92rem',
                        lineHeight: '1.7',
                        color: '#e2e8f0',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        background: 'rgba(10, 15, 29, 0.7)',
                      }}
                    >
                      {activePageItem.text ? (
                        activePageItem.text
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'rgba(255, 255, 255, 0.4)',
                            padding: '3rem',
                            gap: '0.5rem',
                          }}
                        >
                          <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
                          <span>No readable text was extracted for Page {activePageItem.pageNumber}.</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgba(255, 255, 255, 0.4)',
                      padding: '2rem',
                    }}
                  >
                    Select a page on the left to read its extracted text.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.7)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {data?.failedPages && data.failedPages > 0 ? (
              <button
                type="button"
                onClick={() => handleTriggerExtract(true)}
                disabled={isExtracting}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#fca5a5',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: isExtracting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <RefreshCw size={14} className={isExtracting ? 'spinning' : ''} />
                <span>Retry {data.failedPages} Failed Page(s)</span>
              </button>
            ) : null}

            {pages.length > 0 && (
              <button
                type="button"
                onClick={() => handleTriggerExtract(false)}
                disabled={isExtracting}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: isExtracting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <RefreshCw size={14} className={isExtracting ? 'spinning' : ''} />
                <span>Re-Extract All Pages</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#ffffff',
              padding: '0.45rem 1.25rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExtractedPagesModal
