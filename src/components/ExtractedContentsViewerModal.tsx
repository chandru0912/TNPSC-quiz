import React from 'react'
import { X, Layers, CheckCircle2, AlertCircle } from 'lucide-react'
import type { ClassifiedPdfMetadata } from '../../backend/src/services/bulkClassificationService'

interface ExtractedContentsViewerModalProps {
  isOpen: boolean;
  item: ClassifiedPdfMetadata | null;
  onClose: () => void;
}

export const ExtractedContentsViewerModal: React.FC<ExtractedContentsViewerModalProps> = ({
  isOpen,
  item,
  onClose,
}) => {
  if (!isOpen || !item) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 10, 20, 0.82)',
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
          maxWidth: '720px',
          maxHeight: '85vh',
          background: 'linear-gradient(135deg, rgba(20, 28, 48, 0.98), rgba(15, 23, 42, 0.99))',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.18)',
                color: '#34d399',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Extracted Syllabus Hierarchy</h3>
              <p
                style={{
                  margin: '0.15rem 0 0',
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.55)',
                  maxWidth: '480px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.bookName}
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

        {/* Confidence & Metadata Bar */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            fontSize: '0.82rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#cbd5e1' }}>
              Standard: <strong style={{ color: '#6ee7b7' }}>{item.standard}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>
              Subject: <strong style={{ color: '#93c5fd' }}>{item.subject}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>
              Medium: <strong style={{ color: '#fde68a' }}>{item.medium}</strong>
            </span>
            <span style={{ color: '#cbd5e1' }}>
              Term: <strong style={{ color: '#f472b6' }}>{item.term}</strong>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.25rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background:
                  item.confidenceLevel === 'high'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : item.confidenceLevel === 'medium'
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)',
                color:
                  item.confidenceLevel === 'high'
                    ? '#34d399'
                    : item.confidenceLevel === 'medium'
                    ? '#fbbf24'
                    : '#f87171',
                border: `1px solid ${
                  item.confidenceLevel === 'high'
                    ? 'rgba(16, 185, 129, 0.4)'
                    : item.confidenceLevel === 'medium'
                    ? 'rgba(245, 158, 11, 0.4)'
                    : 'rgba(239, 68, 68, 0.4)'
                }`,
              }}
            >
              {item.confidenceLevel === 'high' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              Confidence: {item.confidenceScore}% ({item.confidenceLevel.toUpperCase()})
            </span>
          </div>
        </div>

        {/* Content Tree */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {item.units && item.units.length > 0 ? (
            item.units.map((unit) => (
              <div
                key={unit.unitNumber}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                }}
              >
                {/* Unit Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <span
                    style={{
                      background: 'rgba(99, 102, 241, 0.25)',
                      color: '#a5b4fc',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    Unit {unit.unitNumber}
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9' }}>
                    {unit.unitTitle}
                  </span>
                </div>

                {/* Lessons in Unit */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {unit.lessons.map((lesson) => (
                    <div
                      key={lesson.lessonNumber}
                      style={{
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#cbd5e1',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontFamily: 'monospace',
                            }}
                          >
                            {lesson.lessonNumber}
                          </span>
                          <span style={{ fontSize: '0.88rem', fontWeight: 500, color: '#e2e8f0' }}>
                            {lesson.title}
                          </span>
                        </div>
                        {lesson.startPage && (
                          <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                            Page {lesson.startPage}
                          </span>
                        )}
                      </div>

                      {/* Topics */}
                      {lesson.topics && lesson.topics.length > 0 && (
                        <div
                          style={{
                            marginTop: '0.5rem',
                            paddingTop: '0.45rem',
                            borderTop: '1px dashed rgba(255, 255, 255, 0.06)',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.35rem',
                          }}
                        >
                          {lesson.topics.map((top) => (
                            <span
                              key={top.id}
                              style={{
                                fontSize: '0.72rem',
                                color: '#93c5fd',
                                background: 'rgba(59, 130, 246, 0.12)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                              }}
                            >
                              • {top.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              No structured units or lessons could be extracted.
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Total: <strong>{item.totalUnits}</strong> Units • <strong>{item.totalLessons}</strong> Lessons • <strong>{item.totalTopics}</strong> Topics
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: '#334155',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 500,
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
