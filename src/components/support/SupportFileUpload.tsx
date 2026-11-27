import React, { useRef, useState } from 'react'
import { AlertCircle, FileImage, FileText, RefreshCw, UploadCloud, X } from 'lucide-react'

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf']
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'application/pdf'])
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function validateFile(file: File): string | null {
  const lowerName = file.name.toLowerCase()
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  const hasValidMime = !file.type || ALLOWED_MIMES.has(file.type)
  if (!hasValidExt || !hasValidMime) {
    return 'Unsupported file type. Please upload a PNG, JPG, JPEG, or PDF file.'
  }
  if (file.size > MAX_BYTES) {
    return 'File is too large. Maximum allowed size is 5 MB.'
  }
  return null
}

interface SupportFileUploadProps {
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
  compact?: boolean
  id?: string
}

export const SupportFileUpload: React.FC<SupportFileUploadProps> = ({
  file,
  onChange,
  disabled = false,
  compact = false,
  id,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const handleSelected = (selected: File | null | undefined) => {
    if (!selected) return
    const validationErr = validateFile(selected)
    if (validationErr) {
      setError(validationErr)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setError(null)
    onChange(selected)
  }

  const handleRemove = () => {
    setError(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const isPdf = file ? file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') : false

  return (
    <div className="support-upload-root">
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
        disabled={disabled}
        style={{ display: 'none' }}
        onChange={(e) => handleSelected(e.target.files?.[0])}
      />

      {file ? (
        <div className="support-file-preview-card">
          <div className="support-file-preview-left">
            <span className="support-file-type-icon">
              {isPdf ? <FileText size={18} /> : <FileImage size={18} />}
            </span>
            <div className="support-file-preview-meta">
              <span className="support-file-preview-name" title={file.name}>
                {file.name}
              </span>
              <span className="support-file-preview-size">
                {formatFileSize(file.size)} • {isPdf ? 'PDF Document' : 'Image'}
              </span>
            </div>
          </div>

          <div className="support-file-preview-actions">
            <button
              type="button"
              className="support-file-action-btn"
              onClick={openPicker}
              disabled={disabled}
              title="Replace attached file"
              aria-label="Replace attached file"
            >
              <RefreshCw size={13} />
              <span>Replace</span>
            </button>
            <button
              type="button"
              className="support-file-remove-btn"
              onClick={handleRemove}
              disabled={disabled}
              title="Remove attachment"
              aria-label="Remove attachment"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`support-dropzone ${compact ? 'support-dropzone--compact' : ''} ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Attach a file. Drag and drop files here or browse files."
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openPicker()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragging(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (disabled) return
            handleSelected(e.dataTransfer.files?.[0])
          }}
        >
          <div className="support-dropzone-left">
            <span className="support-dropzone-icon">
              <UploadCloud size={18} />
            </span>
            <div className="support-dropzone-text">
              <span className="support-dropzone-title">Attach a File</span>
              <span className="support-dropzone-sub">
                Drag and drop files here or Browse Files{' '}
                <span className="support-dropzone-hint">(PNG, JPG, JPEG, PDF • Max 5 MB)</span>
              </span>
            </div>
          </div>

          <button
            type="button"
            className="support-browse-btn"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation()
              openPicker()
            }}
          >
            Browse Files
          </button>
        </div>
      )}

      {error && (
        <div className="support-upload-error" role="alert">
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

export default SupportFileUpload
