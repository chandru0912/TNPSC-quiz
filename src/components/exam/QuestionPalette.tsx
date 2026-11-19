import React from 'react';
import { Send, X } from 'lucide-react';
import './QuestionPalette.css';

export type QuestionPaletteStatus =
  | 'answered'
  | 'not-answered'
  | 'review'
  | 'answered-review'
  | 'not-visited';

export interface QuestionPaletteItem {
  id: string | number;
  number: number;
  status: QuestionPaletteStatus;
}

interface QuestionPaletteProps {
  title?: string;
  subtitle?: string;
  items: QuestionPaletteItem[];
  currentNumber: number;
  onSelectQuestion: (questionNumber: number) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  submitLabel?: string;
  onSubmitClick?: () => void;
  showSubmit?: boolean;
}

export const QuestionPalette: React.FC<QuestionPaletteProps> = ({
  title = 'Question Palette',
  subtitle = 'Candidate',
  items,
  currentNumber,
  onSelectQuestion,
  isOpenMobile = false,
  onCloseMobile,
  submitLabel = 'Submit Test',
  onSubmitClick,
  showSubmit = true,
}) => {
  const counts = items.reduce(
    (acc, item) => {
      if (item.status === 'answered') acc.answered++;
      else if (item.status === 'answered-review') acc.answeredReview++;
      else if (item.status === 'review') acc.review++;
      else if (item.status === 'not-answered') acc.notAnswered++;
      else acc.notVisited++;
      return acc;
    },
    { answered: 0, answeredReview: 0, review: 0, notAnswered: 0, notVisited: 0 }
  );

  return (
    <aside className={`qp-sidebar glass ${isOpenMobile ? 'mobile-open' : ''}`}>
      <div className="qp-head">
        <div>
          <h3>{title}</h3>
          <span className="qp-subtitle">{subtitle}</span>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            className="qp-close-btn"
            onClick={onCloseMobile}
            aria-label="Close palette"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="qp-legend">
        <div className="qp-legend-item">
          <span className="qp-legend-dot answered" />
          <span>Answered ({counts.answered})</span>
        </div>
        <div className="qp-legend-item">
          <span className="qp-legend-dot not-answered" />
          <span>Not Answered ({counts.notAnswered})</span>
        </div>
        <div className="qp-legend-item">
          <span className="qp-legend-dot review" />
          <span>Marked ({counts.review})</span>
        </div>
        <div className="qp-legend-item">
          <span className="qp-legend-dot not-visited" />
          <span>Not Visited ({counts.notVisited})</span>
        </div>
        {counts.answeredReview > 0 && (
          <div className="qp-legend-item" style={{ gridColumn: '1 / -1' }}>
            <span className="qp-legend-dot answered-review" />
            <span>Answered &amp; Marked ({counts.answeredReview})</span>
          </div>
        )}
      </div>

      <div className="qp-grid" role="navigation" aria-label="Question palette navigation">
        {items.map((item) => {
          const isCurrent = item.number === currentNumber;
          return (
            <button
              key={item.id}
              type="button"
              className={`qp-btn state-${item.status} ${isCurrent ? 'is-current' : ''}`}
              onClick={() => onSelectQuestion(item.number)}
              aria-label={`Question ${item.number}${isCurrent ? ' (current)' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {item.number}
            </button>
          );
        })}
      </div>

      {showSubmit && onSubmitClick && (
        <button
          type="button"
          className="btn pyp-submit-trigger-btn qp-submit-btn"
          onClick={onSubmitClick}
        >
          <Send size={16} />
          <span>{submitLabel}</span>
        </button>
      )}
    </aside>
  );
};
