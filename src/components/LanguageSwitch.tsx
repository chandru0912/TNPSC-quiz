import { useLanguage } from '../context/LanguageContext'
import { Languages, Check } from 'lucide-react'
import './LanguageSwitch.css'

interface LanguageSwitchProps {
  variant?: 'navbar' | 'section' | 'inline'
  forceVisible?: boolean
  className?: string
}

export const LanguageSwitch = ({
  variant = 'inline',
  forceVisible = false,
  className = '',
}: LanguageSwitchProps) => {
  const { language, setLanguage, isScopedSection } = useLanguage()

  // Strictly enforce user requirement:
  // "Tamil / English language switch only for these three sections: Study Materials, MCQ Questions, Mock Test."
  if (!isScopedSection && !forceVisible) {
    return null
  }

  return (
    <div
      className={`bilingual-switch-container variant-${variant} ${className}`}
      role="region"
      aria-label="Language selection"
    >
      {variant === 'section' && (
        <div className="bilingual-switch-label">
          <Languages size={16} className="bilingual-icon" />
          <span className="bilingual-title">
            {language === 'ta' ? 'மொழி / Language:' : 'Language / மொழி:'}
          </span>
        </div>
      )}

      <div
        className="bilingual-switch-track glass"
        role="radiogroup"
        aria-label="Select study and question language"
      >
        <button
          type="button"
          role="radio"
          aria-checked={language === 'en'}
          className={`bilingual-switch-btn ${language === 'en' ? 'active' : ''}`}
          onClick={() => setLanguage('en')}
          title="Switch all questions, answers, and study notes to English"
        >
          {language === 'en' && <Check size={13} className="bilingual-check" />}
          <span>English</span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={language === 'ta'}
          className={`bilingual-switch-btn ${language === 'ta' ? 'active' : ''}`}
          onClick={() => setLanguage('ta')}
          title="அனைத்து வினாக்கள், விடைகள் மற்றும் பாடக்குறிப்புகளைத் தமிழில் மாற்றுக"
        >
          {language === 'ta' && <Check size={13} className="bilingual-check" />}
          <span className="tamil-font-text">தமிழ்</span>
        </button>
      </div>
    </div>
  )
}

export default LanguageSwitch
