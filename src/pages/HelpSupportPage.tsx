import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LifeBuoy,
  ShieldCheck,
  FileText,
  Lock,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Wrench,
  LogOut,
  Info,
} from 'lucide-react'
import { useStudentAuth } from '../context/StudentAuthContext'
import {
  HELP_CENTER_CONTENT,
  PRIVACY_CENTER_CONTENT,
  TERMS_OF_SERVICE_CONTENT,
  PRIVACY_POLICY_CONTENT,
  type PolicySection,
} from '../data/helpSupportContent'
import FloatingSupportChatWidget from '../components/support/FloatingSupportChatWidget'

export type HelpSupportSection =
  | 'help-center'
  | 'privacy-center'
  | 'terms-of-service'
  | 'privacy-policy'

interface HelpSupportPageProps {
  section: HelpSupportSection
}

const PolicySectionCard: React.FC<{ item: PolicySection }> = ({ item }) => (
  <div
    style={{
      padding: '1.1rem 1.2rem',
      borderRadius: '14px',
      background: 'rgba(15, 23, 42, 0.65)',
      border: '1px solid rgba(148, 163, 184, 0.14)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.55rem',
    }}
  >
    <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>{item.title}</h2>
    {item.paragraphs.map((p, idx) => (
      <p key={idx} style={{ margin: 0, fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.6 }}>
        {p}
      </p>
    ))}
    {item.bullets && item.bullets.length > 0 && (
      <ul
        style={{
          margin: '0.2rem 0 0',
          paddingLeft: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          fontSize: '0.85rem',
          color: '#cbd5e1',
          lineHeight: 1.55,
        }}
      >
        {item.bullets.map((b, idx) => (
          <li key={idx}>{b}</li>
        ))}
      </ul>
    )}
    {item.adminReviewNote && (
      <div
        style={{
          marginTop: '0.35rem',
          padding: '0.65rem 0.85rem',
          borderRadius: '10px',
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.28)',
          color: '#fde68a',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          lineHeight: 1.45,
        }}
      >
        <Info size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#fbbf24' }} />
        <span>
          <strong>Admin Review Notice:</strong> {item.adminReviewNote}
        </span>
      </div>
    )}
  </div>
)

const HelpSupportPage: React.FC<HelpSupportPageProps> = ({ section }) => {
  const navigate = useNavigate()
  const { student, isAuthenticated, logout } = useStudentAuth()

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1480px',
        margin: '0 auto',
        padding: '0.85rem clamp(0.75rem, 1.8vw, 1.5rem) 2.5rem',
        boxSizing: 'border-box',
      }}
    >
      <motion.div
        key={section}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', width: '100%' }}
      >
        {/* 1. HELP CENTER */}
        {section === 'help-center' && (
          <div
            className="glass"
            style={{
              padding: '1.5rem',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <LifeBuoy size={22} style={{ color: '#ffd700' }} />
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                  {HELP_CENTER_CONTENT.title}
                </h1>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.55 }}>
                {HELP_CENTER_CONTENT.subtitle}
              </p>
            </div>

            {/* Platform Usage Guide */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#ffd700', fontSize: '0.9rem', fontWeight: 700 }}>
                <BookOpen size={16} />
                <span>How to Use TNPSC Study Hub</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {HELP_CENTER_CONTENT.quickGuides.map((guide) => (
                  <div
                    key={guide.title}
                    style={{
                      padding: '1rem',
                      borderRadius: '14px',
                      background: 'rgba(15, 23, 42, 0.65)',
                      border: '1px solid rgba(148, 163, 184, 0.14)',
                    }}
                  >
                    <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>{guide.title}</div>
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.55 }}>
                      {guide.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* FAQs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#ffd700', fontSize: '0.9rem', fontWeight: 700 }}>
                <CheckCircle2 size={16} />
                <span>Frequently Asked Questions</span>
              </div>
              {HELP_CENTER_CONTENT.faqs.map((faq) => (
                <div
                  key={faq.question}
                  style={{
                    padding: '1rem 1.1rem',
                    borderRadius: '14px',
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(148, 163, 184, 0.14)',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>{faq.question}</div>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.55 }}>
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>

            {/* Troubleshooting */}
            <div
              style={{
                padding: '1rem 1.15rem',
                borderRadius: '14px',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#ffd700', fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.55rem' }}>
                <Wrench size={16} />
                <span>Troubleshooting Tips</span>
              </div>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: '1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  fontSize: '0.84rem',
                  color: '#cbd5e1',
                  lineHeight: 1.55,
                }}
              >
                {HELP_CENTER_CONTENT.troubleshooting.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>

            {/* Support Contact Notice */}
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.28)',
                color: '#fde68a',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.55rem',
                lineHeight: 1.5,
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#fbbf24' }} />
              <span>
                <strong>Contact Support:</strong> {HELP_CENTER_CONTENT.supportContactNote}
              </span>
            </div>
          </div>
        )}

        {/* 2. PRIVACY CENTER */}
        {section === 'privacy-center' && (
          <div
            className="glass"
            style={{
              padding: '1.5rem',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ShieldCheck size={22} style={{ color: '#ffd700' }} />
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                  {PRIVACY_CENTER_CONTENT.title}
                </h1>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.55 }}>
                {PRIVACY_CENTER_CONTENT.subtitle}
              </p>
            </div>

            {/* Active Session Privacy Control */}
            <div
              style={{
                padding: '1rem 1.15rem',
                borderRadius: '14px',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.85rem',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
                  Account &amp; Session Privacy Status
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  {isAuthenticated && student
                    ? 'Signed in with a verified Google Account. Single active device session protection is enabled.'
                    : 'Not currently signed in. Sign in with a verified Google Account to manage your session.'}
                </div>
              </div>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    logout()
                    navigate('/')
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.52rem 0.95rem',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.14)',
                    border: '1px solid rgba(248, 113, 113, 0.35)',
                    color: '#fca5a5',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <LogOut size={14} />
                  <span>End Current Session</span>
                </button>
              )}
            </div>

            {PRIVACY_CENTER_CONTENT.sections.map((item) => (
              <PolicySectionCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* 3. TERMS OF SERVICE */}
        {section === 'terms-of-service' && (
          <div
            className="glass"
            style={{
              padding: '1.5rem',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={22} style={{ color: '#ffd700' }} />
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                  {TERMS_OF_SERVICE_CONTENT.title}
                </h1>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.55 }}>
                {TERMS_OF_SERVICE_CONTENT.subtitle}
              </p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                {TERMS_OF_SERVICE_CONTENT.lastReviewedNote}
              </p>
            </div>

            {TERMS_OF_SERVICE_CONTENT.sections.map((item) => (
              <PolicySectionCard key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* 4. PRIVACY POLICY */}
        {section === 'privacy-policy' && (
          <div
            className="glass"
            style={{
              padding: '1.5rem',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Lock size={22} style={{ color: '#ffd700' }} />
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                  {PRIVACY_POLICY_CONTENT.title}
                </h1>
              </div>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.55 }}>
                {PRIVACY_POLICY_CONTENT.subtitle}
              </p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                {PRIVACY_POLICY_CONTENT.lastReviewedNote}
              </p>
            </div>

            {PRIVACY_POLICY_CONTENT.sections.map((item) => (
              <PolicySectionCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </motion.div>

      {/* Floating Support Chat Widget on Help Center */}
      {section === 'help-center' && <FloatingSupportChatWidget />}
    </div>
  )
}

export default HelpSupportPage
