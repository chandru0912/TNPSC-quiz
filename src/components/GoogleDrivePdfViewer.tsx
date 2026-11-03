import React, { useState } from 'react';
import {
  X,
  FileText,
  ExternalLink,
  Download,
  Maximize2,
  Minimize2,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { getApiUrl } from '../utils/api';
import { useScrollLock } from '../hooks/useScrollLock';
import './GoogleDrivePdfViewer.css';

export interface GoogleDriveMaterialItem {
  id: number;
  fileName: string;
  originalFileName?: string;
  fileSize?: number;
  group?: string;
  subject?: string;
  standard?: number | string;
  term?: string;
  unit?: number;
  lesson?: string;
  lessonId?: string;
  viewUrl?: string;
  uploadStatus?: string;
  createdAt?: string;
  applicableGroups?: string[];
  extractedToc?: any[];
  confidenceScore?: number;
  medium?: string;
  pdfType?: string;
  totalPages?: number;
  nativePages?: number;
  ocrPages?: number;
  failedPages?: number;
  completionPercentage?: number;
  extractionStatus?: string;
  extractionMethod?: string;
  extractionError?: string;
  extractedAt?: string;
}

interface GoogleDrivePdfViewerProps {
  isOpen: boolean;
  onClose: () => void;
  material: GoogleDriveMaterialItem | null;
}

export const GoogleDrivePdfViewer: React.FC<GoogleDrivePdfViewerProps> = ({
  isOpen,
  onClose,
  material,
}) => {
  useScrollLock(isOpen);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  if (!isOpen || !material) return null;

  const rawViewUrl = material.viewUrl || `/api/drive/view/${material.id}`;
  const fullPdfUrl = getApiUrl(rawViewUrl);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className="gdrive-pdf-overlay" onClick={onClose}>
      <div
        className="gdrive-pdf-container"
        style={isFullscreen ? { maxWidth: '100vw', height: '100vh', borderRadius: 0 } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="gdrive-pdf-header">
          <div className="gdrive-pdf-title-box">
            <div className="gdrive-pdf-icon-badge">
              <FileText size={20} />
            </div>
            <div className="gdrive-pdf-title-text">
              <h3 className="gdrive-pdf-title" title={material.fileName}>
                {material.fileName}
              </h3>
              <p className="gdrive-pdf-subtitle">
                {material.standard ? <span>Class {material.standard}</span> : null}
                {material.subject ? <span>• {material.subject}</span> : null}
                {material.term ? <span>• {material.term}</span> : null}
                {material.fileSize ? <span>• {formatFileSize(material.fileSize)}</span> : null}
              </p>
            </div>
          </div>

          <div className="gdrive-pdf-controls">
            <a
              href={fullPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gdrive-pdf-btn"
              title="Open PDF in new browser tab"
            >
              <ExternalLink size={14} />
              <span>Open Tab</span>
            </a>

            <a
              href={fullPdfUrl}
              download={material.fileName}
              className="gdrive-pdf-btn gdrive-pdf-btn-gold"
              title="Save or Download PDF"
            >
              <Download size={14} />
              <span>Download</span>
            </a>

            <button
              type="button"
              className="gdrive-pdf-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            <button
              type="button"
              className="gdrive-pdf-close-btn"
              onClick={onClose}
              title="Close PDF Viewer"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* PDF Viewer Body */}
        <div className="gdrive-pdf-body">
          {isLoading && !hasError && (
            <div className="gdrive-pdf-loading">
              <Loader2 size={36} className="animate-spin" style={{ color: '#ffd700' }} />
              <span>Streaming secure PDF from Google Drive...</span>
            </div>
          )}

          {hasError ? (
            <div className="gdrive-pdf-error-box">
              <AlertCircle size={44} />
              <h3>Failed to stream PDF from Google Drive</h3>
              <p>Please check your internet connection or verify Google Drive integration.</p>
              <button
                type="button"
                className="gdrive-pdf-btn gdrive-pdf-btn-gold"
                onClick={() => {
                  setHasError(false);
                  setIsLoading(true);
                }}
              >
                <RotateCcw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <iframe
              key={fullPdfUrl}
              src={`${fullPdfUrl}#toolbar=1&navpanes=1&statusbar=1&view=FitH`}
              className="gdrive-pdf-iframe"
              title={material.fileName}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleDrivePdfViewer;
