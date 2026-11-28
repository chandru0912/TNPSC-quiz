import React from 'react'
import { Languages, Loader2, RefreshCw } from 'lucide-react'
import { useStudyMaterialsLanguage } from '../../context/StudyMaterialsLanguageContext'
import './StudyMaterialsTranslatorBar.css'

interface StudyMaterialsTranslatorBarProps {
  compact?: boolean
}

export const StudyMaterialsTranslatorBar: React.FC<StudyMaterialsTranslatorBarProps> = ({ compact = false }) => {
  const { language, setLanguage, isTranslating, progress, error, retryTranslation } = useStudyMaterialsLanguage()

  const bar = (
    <div className="sm-translator-bar" data-no-translate="true">
      {language === 'ta' && isTranslating && (
        <span className="sm-translator-status" role="status" aria-live="polite">
          <Loader2 size={13} className="sm-spin" />
          <span>
            {progress.total > 0
              ? `Translating (${progress.completed}/${progress.total})...`
              : 'Translating to தமிழ்...'}
          </span>
        </span>
      )}

      {language === 'ta' && !isTranslating && error && (
        <span className="sm-translator-status is-error" role="alert">
          <span>Partial translation</span>
          <button type="button" className="sm-translator-retry" onClick={retryTranslation}>
            <RefreshCw size={11} />
            <span>Retry</span>
          </button>
        </span>
      )}

      <div className="sm-translator-pill" role="group" aria-label="Study Materials Language">
        <Languages size={15} className="sm-translator-icon" />
        <button
          type="button"
          className={`sm-lang-btn ${language === 'en' ? 'active' : ''}`}
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
        >
          English
        </button>
        <button
          type="button"
          className={`sm-lang-btn ${language === 'ta' ? 'active' : ''}`}
          aria-pressed={language === 'ta'}
          onClick={() => setLanguage('ta')}
        >
          தமிழ்
        </button>
      </div>
    </div>
  )

  if (compact) return bar

  return (
    <div className="sm-translator-dock" data-no-translate="true">
      {bar}
    </div>
  )
}
