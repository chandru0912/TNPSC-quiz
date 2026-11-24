import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import './GlassSelect.css'

export interface GlassSelectOption {
  value: string
  label: string
  count?: number
}

interface GlassSelectProps {
  label: string
  icon?: React.ReactNode
  value: string
  options: GlassSelectOption[]
  onChange: (value: string) => void
  loading?: boolean
  disabled?: boolean
  placeholder?: string
}

export const GlassSelect: React.FC<GlassSelectProps> = ({
  label,
  icon,
  value,
  options,
  onChange,
  loading = false,
  disabled = false,
  placeholder = 'Select...',
}) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const selectedOption = options.find((o) => o.value === value)
  const isFiltered = value !== 'all' && value !== ''

  return (
    <div className="glass-select-root" ref={rootRef}>
      <span className="glass-select-label">
        {icon}
        <span>{label}</span>
      </span>
      <button
        type="button"
        className={`glass-select-trigger ${open ? 'is-open' : ''} ${isFiltered ? 'is-active' : ''}`}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="glass-select-value">
          {loading ? 'Loading...' : selectedOption?.label || placeholder}
        </span>
        {loading ? (
          <Loader2 size={14} className="spin-icon glass-select-chevron" />
        ) : (
          <ChevronDown size={15} className="glass-select-chevron" />
        )}
      </button>

      {open && (
        <div className="glass-select-menu" role="listbox" aria-label={label}>
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`glass-select-option ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {isSelected && <Check size={13} style={{ color: '#34d399', flexShrink: 0 }} />}
                  <span>{opt.label}</span>
                </span>
                {opt.count !== undefined && <span className="glass-select-count">{opt.count}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
