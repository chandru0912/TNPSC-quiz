import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  AlertTriangle,
  RotateCcw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { apiFetch } from '../utils/api';

export interface ExtractedPageItem {
  pageNumber: number;
  text: string;
  unitId?: number;
  unitTitle?: string;
  lessonTitle?: string;
  topic?: string;
  isOcr: boolean;
  extractionMethod?: string;
  ocrConfidence?: number | null;
  status?: string;
  error?: string | null;
}

export interface ExtractedReviewTarget {
  id: number;
  fileName: string;
  type: 'drive' | 'textbook';
  pdfType?: string;
  totalPages?: number;
  nativePages?: number;
  ocrPages?: number;
  failedPages?: number;
  status?: string;
  completionPercentage?: number;
}

interface ExtractedTextReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ExtractedReviewTarget | null;
  onRefresh?: () => void;
}

export const ExtractedTextReviewModal: React.FC<ExtractedTextReviewModalProps> = ({
  isOpen,
  onClose,
  target,
  onRefresh,
}) => {
  const [pages, setPages] = useState<ExtractedPageItem[]>([]);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'native' | 'ocr' | 'failed'>('all');
  const [copied, setCopied] = useState<boolean>(false);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !target) {
      setPages([]);
      setSelectedPageIndex(0);
      setError(null);
      setSearchTerm('');
      setRetryMessage(null);
      return;
    }

    let isMounted = true;
    const fetchPages = async () => {
      setLoading(true);
      setError(null);
      try {
        const url =
          target.type === 'drive'
            ? `/api/drive/materials/${target.id}/extracted-pages`
            : `/api/textbooks/${target.id}/extracted-pages`;
        const res = await apiFetch(url);
        const data = await res.json();

        if (isMounted) {
          if (data.status === 'success' && data.data?.pages) {
            setPages(data.data.pages);
            setSelectedPageIndex(0);
          } else {
            setError(data.message || 'No extracted pages found.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to fetch extracted pages.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPages();
    return () => {
      isMounted = false;
    };
  }, [isOpen, target]);

  const filteredPages = useMemo(() => {
    return pages.filter((p) => {
      if (filterType === 'native' && (p.isOcr || p.status === 'failed')) return false;
      if (filterType === 'ocr' && (!p.isOcr || p.status === 'failed')) return false;
      if (filterType === 'failed' && p.status !== 'failed') return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const pageNumMatch = String(p.pageNumber).includes(term);
        const textMatch = (p.text || '').toLowerCase().includes(term);
        const lessonMatch = (p.lessonTitle || '').toLowerCase().includes(term);
        return pageNumMatch || textMatch || lessonMatch;
      }
      return true;
    });
  }, [pages, filterType, searchTerm]);

  const currentPage = pages[selectedPageIndex] || filteredPages[0] || null;

  const handleCopyText = () => {
    if (!currentPage || !currentPage.text) return;
    navigator.clipboard.writeText(currentPage.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetryFailed = async () => {
    if (!target) return;
    setRetrying(true);
    setRetryMessage('Retrying failed pages via OCR...');
    try {
      const url =
        target.type === 'drive'
          ? `/api/drive/materials/${target.id}/retry-failed`
          : `/api/textbooks/${target.id}/retry-failed`;
      const res = await apiFetch(url, { method: 'POST' });
      const data = await res.json();

      if (data.status === 'success') {
        setRetryMessage('Retry completed successfully. Refreshing pages...');
        setTimeout(async () => {
          setRetryMessage(null);
          // Refresh pages
          const pUrl =
            target.type === 'drive'
              ? `/api/drive/materials/${target.id}/extracted-pages`
              : `/api/textbooks/${target.id}/extracted-pages`;
          const pRes = await apiFetch(pUrl);
          const pData = await pRes.json();
          if (pData.status === 'success' && pData.data?.pages) {
            setPages(pData.data.pages);
          }
          onRefresh?.();
        }, 1200);
      } else {
        setRetryMessage(`Retry completed with notice: ${data.message}`);
      }
    } catch (err: any) {
      setRetryMessage(`Retry error: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  if (!isOpen || !target) return null;

  const pdfType = target.pdfType || 'UNKNOWN';
  const totalPages = target.totalPages || pages.length;
  const nativePages = target.nativePages || pages.filter((p) => !p.isOcr && p.status !== 'failed').length;
  const ocrPages = target.ocrPages || pages.filter((p) => p.isOcr && p.status !== 'failed').length;
  const failedPages = target.failedPages || pages.filter((p) => p.status === 'failed').length;
  const status = target.status || (failedPages > 0 ? 'PARTIALLY_COMPLETED' : 'COMPLETED');
  const completionPercentage = target.completionPercentage ?? (totalPages > 0 ? Math.round(((totalPages - failedPages) / totalPages) * 100) : 100);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(5, 10, 20, 0.85)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          height: '90vh',
          background: 'linear-gradient(145deg, #0e1726, #090d16)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75)',
          color: '#f8fafc',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.35))',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(245, 158, 11, 0.4)',
              }}
            >
              <BookOpen size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>
                  {target.fileName}
                </h3>
                {/* PDF Type Pill */}
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background:
                      pdfType === 'TEXT_BASED'
                        ? 'rgba(16, 185, 129, 0.18)'
                        : pdfType === 'SCANNED'
                        ? 'rgba(168, 85, 247, 0.2)'
                        : pdfType === 'MIXED'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                    color:
                      pdfType === 'TEXT_BASED'
                        ? '#34d399'
                        : pdfType === 'SCANNED'
                        ? '#c084fc'
                        : pdfType === 'MIXED'
                        ? '#fbbf24'
                        : '#f87171',
                    border: `1px solid ${
                      pdfType === 'TEXT_BASED'
                        ? 'rgba(16, 185, 129, 0.4)'
                        : pdfType === 'SCANNED'
                        ? 'rgba(168, 85, 247, 0.4)'
                        : pdfType === 'MIXED'
                        ? 'rgba(245, 158, 11, 0.4)'
                        : 'rgba(239, 68, 68, 0.4)'
                    }`,
                  }}
                >
                  {pdfType} PDF
                </span>
                {/* Extraction Status Pill */}
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background:
                      status === 'COMPLETED'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : status === 'PARTIALLY_COMPLETED'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : status === 'OCR_PROCESSING'
                        ? 'rgba(99, 102, 241, 0.2)'
                        : status === 'EXTRACTING'
                        ? 'rgba(6, 182, 212, 0.2)'
                        : 'rgba(239, 68, 68, 0.2)',
                    color:
                      status === 'COMPLETED'
                        ? '#34d399'
                        : status === 'PARTIALLY_COMPLETED'
                        ? '#fbbf24'
                        : status === 'OCR_PROCESSING'
                        ? '#818cf8'
                        : status === 'EXTRACTING'
                        ? '#22d3ee'
                        : '#f87171',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {status} ({completionPercentage}%)
                </span>
              </div>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                Inspection & Text Verification Viewer • Tamil Unicode & English Text
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {failedPages > 0 && (
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={retrying}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#fbbf24',
                  cursor: retrying ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <RotateCcw size={14} className={retrying ? 'spinning' : ''} />
                <span>{retrying ? 'Retrying...' : `Retry ${failedPages} Failed Page(s)`}</span>
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: 'pointer',
                padding: '0.45rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status Metrics Bar */}
        <div
          style={{
            padding: '0.65rem 1.5rem',
            background: 'rgba(0, 0, 0, 0.3)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            fontSize: '0.8rem',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#cbd5e1' }}>
              Total Pages: <strong style={{ color: '#ffffff' }}>{totalPages}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>
              Native Text: <strong style={{ color: '#34d399' }}>{nativePages}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>
              OCR Extracted: <strong style={{ color: '#c084fc' }}>{ocrPages}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>
              Failed Pages: <strong style={{ color: failedPages > 0 ? '#f87171' : '#94a3b8' }}>{failedPages}</strong>
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '220px' }}>
            <div
              style={{
                flex: 1,
                height: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '999px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${completionPercentage}%`,
                  height: '100%',
                  background:
                    completionPercentage === 100
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : 'linear-gradient(90deg, #f59e0b, #d97706)',
                  borderRadius: '999px',
                }}
              />
            </div>
            <span style={{ fontWeight: 700, color: completionPercentage === 100 ? '#34d399' : '#fbbf24', fontSize: '0.78rem' }}>
              {completionPercentage}%
            </span>
          </div>
        </div>

        {retryMessage && (
          <div
            style={{
              padding: '0.5rem 1.5rem',
              background: 'rgba(245, 158, 11, 0.1)',
              borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
              color: '#fbbf24',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Sparkles size={14} />
            {retryMessage}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '0.5rem 1.5rem',
              background: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* Modal Main Content: Left Page Directory + Right Page Preview */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Panel: Pages List */}
          <div
            style={{
              width: '280px',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              background: 'rgba(0, 0, 0, 0.18)',
              flexShrink: 0,
            }}
          >
            {/* Filter & Search Bar */}
            <div style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '6px',
                  padding: '0.35rem 0.6rem',
                  gap: '0.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Search size={14} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
                <input
                  type="text"
                  placeholder="Search pages or text..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    width: '100%',
                  }}
                />
              </div>

              {/* Filter Tabs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '4px',
                  marginTop: '0.5rem',
                }}
              >
                {(['all', 'native', 'ocr', 'failed'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setFilterType(tab)}
                    style={{
                      padding: '0.25rem 0',
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      background: filterType === tab ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                      color:
                        filterType === tab
                          ? '#ffffff'
                          : tab === 'failed' && failedPages > 0
                          ? '#f87171'
                          : 'rgba(255, 255, 255, 0.45)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Page Thumbnails / List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {loading ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                  Loading pages...
                </div>
              ) : filteredPages.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                  No pages match criteria.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {filteredPages.map((page) => {
                    const originalIndex = pages.findIndex((p) => p.pageNumber === page.pageNumber);
                    const isSelected = originalIndex === selectedPageIndex;
                    const isFailed = page.status === 'failed';

                    return (
                      <button
                        key={page.pageNumber}
                        type="button"
                        onClick={() => setSelectedPageIndex(originalIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.45rem 0.65rem',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid transparent',
                          background: isSelected
                            ? 'rgba(245, 158, 11, 0.15)'
                            : isFailed
                            ? 'rgba(239, 68, 68, 0.08)'
                            : 'rgba(255, 255, 255, 0.02)',
                          color: isSelected ? '#fbbf24' : '#f1f5f9',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '0.78rem',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                          <span style={{ fontWeight: 700, minWidth: '22px' }}>#{page.pageNumber}</span>
                          <span
                            style={{
                              color: isSelected ? '#fde68a' : '#94a3b8',
                              fontSize: '0.72rem',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '140px',
                            }}
                          >
                            {page.lessonTitle || (page.text ? page.text.slice(0, 20) : 'No content')}
                          </span>
                        </div>

                        {isFailed ? (
                          <AlertTriangle size={12} style={{ color: '#f87171', flexShrink: 0 }} />
                        ) : page.isOcr ? (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(168, 85, 247, 0.2)',
                              color: '#c084fc',
                              flexShrink: 0,
                            }}
                          >
                            OCR
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              flexShrink: 0,
                            }}
                          >
                            Native
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Page Inspector */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0, 0, 0, 0.22)' }}>
            {currentPage ? (
              <>
                {/* Active Page Header Strip */}
                <div
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(255, 255, 255, 0.015)',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPageIndex((prev) => Math.max(0, prev - 1))}
                        disabled={selectedPageIndex === 0}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#ffffff',
                          cursor: selectedPageIndex === 0 ? 'not-allowed' : 'pointer',
                          padding: '0.3rem',
                          opacity: selectedPageIndex === 0 ? 0.3 : 1,
                        }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
                        Page {currentPage.pageNumber} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedPageIndex((prev) => Math.min(pages.length - 1, prev + 1))}
                        disabled={selectedPageIndex >= pages.length - 1}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#ffffff',
                          cursor: selectedPageIndex >= pages.length - 1 ? 'not-allowed' : 'pointer',
                          padding: '0.3rem',
                          opacity: selectedPageIndex >= pages.length - 1 ? 0.3 : 1,
                        }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    {/* Method Tag */}
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: currentPage.isOcr ? 'rgba(168, 85, 247, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: currentPage.isOcr ? '#c084fc' : '#34d399',
                        border: `1px solid ${currentPage.isOcr ? 'rgba(168, 85, 247, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                      }}
                    >
                      {currentPage.extractionMethod || (currentPage.isOcr ? 'Google Vision OCR' : 'Native InDesign/pdfjs')}
                    </span>

                    {currentPage.ocrConfidence && (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Confidence: <strong style={{ color: '#38bdf8' }}>{Math.round(currentPage.ocrConfidence * 100)}%</strong>
                      </span>
                    )}

                    {currentPage.lessonTitle && (
                      <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                        📖 {currentPage.lessonTitle}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {currentPage.text ? `${currentPage.text.length} chars` : '0 chars'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyText}
                      disabled={!currentPage.text}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: copied ? '#34d399' : '#e2e8f0',
                        cursor: 'pointer',
                      }}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                    </button>
                  </div>
                </div>

                {/* Text Body */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '1.25rem 1.5rem',
                    fontFamily:
                      "'Mukta Malar', 'Noto Sans Tamil', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    lineHeight: '1.7',
                    fontSize: '0.92rem',
                    color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {currentPage.status === 'failed' ? (
                    <div
                      style={{
                        padding: '1.5rem',
                        borderRadius: '10px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        color: '#f87171',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        <AlertTriangle size={18} />
                        Page {currentPage.pageNumber} Extraction Notice
                      </div>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#fca5a5' }}>
                        {currentPage.error || 'This page contained no selectable native text and OCR found no readable characters (commonly a blank back cover or purely graphic illustration).'}
                      </p>
                    </div>
                  ) : currentPage.text ? (
                    currentPage.text
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                      No text content on this page.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  color: '#64748b',
                }}
              >
                Select a page to view extracted content
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
