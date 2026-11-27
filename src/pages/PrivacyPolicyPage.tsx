import React from 'react'
import { motion } from 'framer-motion'
import { Calendar, Clock, Cookie, Info, Lock, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { PRIVACY_POLICY_DOCUMENT } from '../data/privacyPolicyData'
import { useCookieConsent } from '../context/CookieConsentContext'
import CookieConsentManager from '../components/CookieConsentManager'
import './PrivacyPolicyPage.css'

const PrivacyPolicyPage: React.FC = () => {
  const doc = PRIVACY_POLICY_DOCUMENT
  const { openPreferences } = useCookieConsent()

  return (
    <div className="privacy-policy-page" lang="en">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header / Metadata */}
        <header className="privacy-policy-hero glass">
          <div className="privacy-policy-hero-top">
            <div>
              <div className="privacy-policy-title-row">
                <Lock size={24} style={{ color: '#ffd700', flexShrink: 0 }} />
                <h1 className="privacy-policy-title">{doc.title}</h1>
              </div>
              <p className="privacy-policy-subtitle">{doc.subtitle}</p>
            </div>
          </div>

          <div className="privacy-policy-dates">
            <span className="privacy-date-pill">
              <Calendar size={14} style={{ color: '#ffd700' }} />
              <span>
                {doc.effectiveDateLabel}: <strong>{doc.effectiveDateValue}</strong>
              </span>
            </span>
            <span className="privacy-date-pill">
              <Clock size={14} style={{ color: '#ffd700' }} />
              <span>
                {doc.lastUpdatedLabel}: <strong>{doc.lastUpdatedValue}</strong>
              </span>
            </span>
          </div>

          <div className="privacy-legal-banner" role="note">
            <ShieldCheck size={17} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
            <span>{doc.legalReviewBanner}</span>
          </div>
        </header>

        {/* Full-Width Single-Column Privacy Policy Content (27 Sections) */}
        <div className="privacy-sections-stack">
          {doc.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="privacy-section-card glass"
              aria-labelledby={`heading-${section.id}`}
            >
              <h2 id={`heading-${section.id}`} className="privacy-section-heading">
                <span className="privacy-section-num">{section.number}.</span>
                <span>{section.title}</span>
              </h2>

              {section.paragraphs.map((p, idx) => (
                <p key={idx} className="privacy-section-p">
                  {p}
                </p>
              ))}

              {section.bullets && section.bullets.length > 0 && (
                <ul className="privacy-section-list">
                  {section.bullets.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}

              {section.subsections && section.subsections.length > 0 && (
                <div className="privacy-subsections-stack">
                  {section.subsections.map((sub) => (
                    <div key={sub.label} className="privacy-subsection-block">
                      <h3 className="privacy-subsection-heading">{sub.label}</h3>
                      {sub.paragraphs.map((p, pIdx) => (
                        <p key={pIdx} className="privacy-section-p">
                          {p}
                        </p>
                      ))}
                      {sub.bullets && sub.bullets.length > 0 && (
                        <ul className="privacy-section-list">
                          {sub.bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {section.table && (
                <div className="privacy-table-wrap">
                  <table className="privacy-table">
                    <thead>
                      <tr>
                        {section.table.headers.map((header, hIdx) => (
                          <th key={hIdx}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {section.table.rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {section.note && (
                <div className="privacy-section-note">
                  <Info size={16} style={{ color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
                  <span>{section.note}</span>
                </div>
              )}

              {section.showCookieControls && (
                <div className="privacy-cookie-controls-block">
                  <div className="privacy-cookie-action-row">
                    <button
                      type="button"
                      className="privacy-manage-cookies-btn"
                      onClick={openPreferences}
                    >
                      <SlidersHorizontal size={16} />
                      <Cookie size={16} />
                      <span>Manage Cookie Preferences</span>
                    </button>
                  </div>
                  <CookieConsentManager />
                </div>
              )}
            </section>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

export default PrivacyPolicyPage
