import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import './DateCalendarPopover.css'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const POPOVER_WIDTH = 304
const ESTIMATED_HEIGHT = 372

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

type Position = { top: number; left: number; width: number }

/**
 * The existing top-right date chip, now a button that opens a calendar popover.
 * The chip markup/label is unchanged — only behaviour was added.
 */
const DateCalendarPopover = () => {
  const today = useMemo(() => new Date(), [])
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [position, setPosition] = useState<Position>({
    top: 0,
    left: 0,
    width: POPOVER_WIDTH,
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  // Native Date handles month lengths, leap years and year rollover
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()

  const cells = useMemo(() => {
    const list: Array<number | null> = []
    for (let i = 0; i < firstWeekday; i += 1) list.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) list.push(day)
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [firstWeekday, daysInMonth])

  const monthLabel = viewDate.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  })

  /** Keep the popover anchored to the chip and inside the viewport */
  const placePopover = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 24)

    let left = rect.right - width
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12))

    let top = rect.bottom + 10
    if (top + ESTIMATED_HEIGHT > window.innerHeight - 12) {
      top = Math.max(12, rect.top - ESTIMATED_HEIGHT - 10)
    }

    setPosition({ top, left, width })
  }, [])

  useEffect(() => {
    if (!open) return

    placePopover()
    const onViewportChange = () => placePopover()
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [open, placePopover])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        popoverRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggleOpen = () => {
    if (!open) {
      // Always re-open on the selected date's month
      setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))
    }
    setOpen((previous) => !previous)
  }

  const changeMonth = (offset: number) => {
    setViewDate(new Date(year, month + offset, 1))
  }

  const selectDay = (day: number) => {
    setSelectedDate(new Date(year, month, day))
  }

  const chipLabel = today.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <span className="dash-date-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={`dash-chip dash-date-trigger${open ? ' is-open' : ''}`}
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Current date ${chipLabel}. Open calendar`}
      >
        <Calendar size={16} />
        <span>{chipLabel}</span>
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
              aria-label="Select a date"
            >
              <div className="date-pop-head">
                <button
                  type="button"
                  className="date-pop-nav"
                  onClick={() => changeMonth(-1)}
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
                  onClick={() => changeMonth(1)}
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
                {cells.map((day, index) => {
                  if (day === null) {
                    return (
                      <span
                        key={`empty-${index}`}
                        className="date-pop-empty"
                        aria-hidden="true"
                      />
                    )
                  }

                  const date = new Date(year, month, day)
                  const isSelected = isSameDay(date, selectedDate)
                  const isToday = isSameDay(date, today)

                  return (
                    <button
                      key={day}
                      type="button"
                      className={[
                        'date-pop-day',
                        isSelected ? 'is-selected' : '',
                        isToday && !isSelected ? 'is-today' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => selectDay(day)}
                      aria-pressed={isSelected}
                      aria-label={date.toLocaleDateString('en-IN', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  )
}

export default DateCalendarPopover
