import React, { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Send, ShieldAlert, X } from 'lucide-react'
import './TestSubmissionConfirmModal.css'

export interface TestSubmissionConfirmModalProps {
  isOpen: boolean
  totalQuestions: number
  answeredQuestions: number
  markedForReview?: number
  isSubmitting: boolean
  errorMessage?: string | null
  onClose: () => void
  onConfirmSubmit: () => void
}

export const TestSubmissionConfirmModal: React.FC<TestSubmissionConfirmModalProps> = ({
  isOpen,
  totalQuestions,
  answeredQuestions,
  markedForReview,
  isSubmitting,
  errorMessage,
  onClose,
  onConfirmSubmit,
}) => {
  const safeTotal = Math.max(0, totalQuestions)
  const safeAnswered = Math.max(0, Math.min(safeTotal, answeredQuestions))
  const unansweredCount = Math.max(0, safeTotal - safeAnswered)
  const hasUnanswered = unansweredCount > 0

  // Allow Escape key to close modal when not actively submitting
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  return (
    <div
      className="tsm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tsm-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose()
        }
      }}
    >
      <div className="tsm-card">
        <div className="tsm-header">
          <div className="tsm-title-row">
            <span className={`tsm-header-icon ${hasUnanswered ? 'is-warning' : 'is-ready'}`}>
              {hasUnanswered ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            </span>
            <h3 id="tsm-modal-title" className="tsm-title">
              Confirm Test Submission
            </h3>
          </div>
          <button
            type="button"
            className="tsm-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close submission confirmation"
          >
            <X size={16} />
          </button>
        </div>

        <div className="tsm-body">
          <p className="tsm-message">
            Are you sure you want to submit your test? Please review your answers before final submission.
          </p>

          {/* Live Submission Summary */}
          <div className="tsm-summary-grid">
            <div className="tsm-summary-item">
              <span className="tsm-summary-label">Total Questions</span>
              <strong className="tsm-summary-value">{safeTotal}</strong>
            </div>
            <div className="tsm-summary-item is-answered">
              <span className="tsm-summary-label">Answered</span>
              <strong className="tsm-summary-value">{safeAnswered}</strong>
            </div>
            <div className={`tsm-summary-item ${hasUnanswered ? 'is-unanswered' : ''}`}>
              <span className="tsm-summary-label">Unanswered</span>
              <strong className="tsm-summary-value">{unansweredCount}</strong>
            </div>
            {typeof markedForReview === 'number' && (
              <div className="tsm-summary-item is-review">
                <span className="tsm-summary-label">Marked for Review</span>
                <strong className="tsm-summary-value">{markedForReview}</strong>
              </div>
            )}
          </div>

          {/* Conditional Status Callout */}
          {hasUnanswered ? (
            <div className="tsm-callout tsm-callout--warning" role="status">
              <AlertTriangle size={16} className="tsm-callout-icon" />
              <span>
                You have <strong>{unansweredCount}</strong> unanswered{' '}
                {unansweredCount === 1 ? 'question' : 'questions'}. These questions may receive zero marks
                according to the existing evaluation rules.
              </span>
            </div>
          ) : (
            <div className="tsm-callout tsm-callout--success" role="status">
              <CheckCircle2 size={16} className="tsm-callout-icon" />
              <span>Great! You have answered all questions. Are you ready to submit your test?</span>
            </div>
          )}

          {/* Error Banner on API/Network Failure (answers preserved for safe retry) */}
          {errorMessage && (
            <div className="tsm-callout tsm-callout--error" role="alert">
              <ShieldAlert size={16} className="tsm-callout-icon" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="tsm-actions">
          <button
            type="button"
            className="tsm-btn tsm-btn--secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {hasUnanswered ? 'Review Test' : 'Go Back'}
          </button>
          <button
            type="button"
            className={`tsm-btn ${hasUnanswered ? 'tsm-btn--submit-warn' : 'tsm-btn--submit'}`}
            onClick={onConfirmSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="tsm-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send size={14} />
                <span>{errorMessage ? 'Retry Submit' : hasUnanswered ? 'Submit Anyway' : 'Confirm Submit'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default TestSubmissionConfirmModal
