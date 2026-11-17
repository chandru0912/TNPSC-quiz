import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';
import './DateCalendarPopover.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const POPOVER_WIDTH = 312;
const ESTIMATED_HEIGHT = 420;

interface DateRangePickerProps {
  startDate: string; // 'YYYY-MM-DD' or ''
  endDate: string; // 'YYYY-MM-DD' or ''
  onChange: (startDate: string, endDate: string) => void;
}

function parseYmd(ymd: string): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDayTime(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
}) => {
  const [today] = useState(() => new Date());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<Date | null>(() => parseYmd(startDate));
  const [draftEnd, setDraftEnd] = useState<Date | null>(() => parseYmd(endDate));
  const [viewDate, setViewDate] = useState(() => {
    const initial = parseYmd(startDate) || new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const [position, setPosition] = useState({ top: 0, left: 0, width: POPOVER_WIDTH });

  useScrollLock(open);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const cells = useMemo(() => {
    const list: Array<number | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) list.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) list.push(day);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [firstWeekday, daysInMonth]);

  const monthLabel = viewDate.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const placePopover = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 24);

    let left = rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));

    let top = rect.bottom + 8;
    if (top + ESTIMATED_HEIGHT > window.innerHeight - 12) {
      top = Math.max(12, rect.top - ESTIMATED_HEIGHT - 8);
    }

    setPosition({ top, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    placePopover();
    const onResize = () => placePopover();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, placePopover]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open) {
      const parsedStart = parseYmd(startDate);
      const parsedEnd = parseYmd(endDate);
      setDraftStart(parsedStart);
      setDraftEnd(parsedEnd);
      const anchor = parsedStart || today;
      setViewDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    }
    setOpen((prev) => !prev);
  };

  const handleDayClick = (day: number) => {
    const clicked = new Date(year, month, day);
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(clicked);
      setDraftEnd(null);
      return;
    }

    if (startOfDayTime(clicked) < startOfDayTime(draftStart)) {
      setDraftEnd(draftStart);
      setDraftStart(clicked);
    } else {
      setDraftEnd(clicked);
    }
  };

  const handleApply = () => {
    if (!draftStart) {
      onChange('', '');
      setOpen(false);
      return;
    }
    const effectiveEnd = draftEnd || draftStart;
    onChange(toYmd(draftStart), toYmd(effectiveEnd));
    setOpen(false);
  };

  const handleClear = () => {
    setDraftStart(null);
    setDraftEnd(null);
    onChange('', '');
    setOpen(false);
  };

  const appliedStart = parseYmd(startDate);
  const appliedEnd = parseYmd(endDate);
  const triggerLabel =
    appliedStart && appliedEnd
      ? isSameDay(appliedStart, appliedEnd)
        ? formatDisplayDate(appliedStart)
        : `${formatDisplayDate(appliedStart)} – ${formatDisplayDate(appliedEnd)}`
      : appliedStart
        ? formatDisplayDate(appliedStart)
        : 'Select Date Range';

  const startMs = draftStart ? startOfDayTime(draftStart) : null;
  const endMs = draftEnd ? startOfDayTime(draftEnd) : null;

  return (
    <span className="dash-date-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={`date-range-trigger${open ? ' is-open' : ''}`}
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Date range filter: ${triggerLabel}`}
      >
        <Calendar size={15} style={{ color: '#ffd700', flexShrink: 0 }} />
        <span className="date-range-trigger-text">{triggerLabel}</span>
        <ChevronDown size={14} style={{ opacity: 0.7, flexShrink: 0 }} />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popoverRef}
              className="date-pop"
              style={{ top: position.top, left: position.left, width: position.width }}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              role="dialog"
              aria-modal="false"
              aria-label="Select date range"
            >
              <div className="date-pop-head">
                <button
                  type="button"
                  className="date-pop-nav"
                  onClick={() => setViewDate(new Date(year, month - 1, 1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="date-pop-title" aria-live="polite">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  className="date-pop-nav"
                  onClick={() => setViewDate(new Date(year, month + 1, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="date-pop-weekdays" aria-hidden="true">
                {WEEKDAYS.map((day) => (
                  <span key={day} className="date-pop-weekday">
                    {day}
                  </span>
                ))}
              </div>

              <div className="date-pop-grid" role="grid" aria-label={monthLabel}>
                {cells.map((day, idx) => {
                  if (day === null) {
                    return <span key={`empty-${idx}`} className="date-pop-empty" aria-hidden="true" />;
                  }
                  const date = new Date(year, month, day);
                  const ms = startOfDayTime(date);
                  const isStart = startMs !== null && ms === startMs;
                  const isEnd = endMs !== null && ms === endMs;
                  const isEndpoint = isStart || isEnd;
                  const isInRange = startMs !== null && endMs !== null && ms > startMs && ms < endMs;
                  const isToday = isSameDay(date, today);

                  return (
                    <button
                      key={day}
                      type="button"
                      className={[
                        'date-pop-day',
                        isEndpoint ? 'is-range-endpoint' : '',
                        isInRange ? 'is-in-range' : '',
                        isToday && !isEndpoint ? 'is-today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => handleDayClick(day)}
                      aria-pressed={isEndpoint || isInRange}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="date-range-footer">
                <button type="button" className="date-range-btn-clear" onClick={handleClear}>
                  Clear
                </button>
                <button
                  type="button"
                  className="date-range-btn-apply"
                  onClick={handleApply}
                  disabled={!draftStart && !startDate}
                >
                  Apply Range
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
};

export default DateRangePicker;
