import React from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck } from 'lucide-react'

const USER_POLICY_SECTIONS = [
  {
    id: 'purpose',
    title: '1. Purpose & Scope',
    paragraphs: [
      'This User Policy outlines the expected conduct, responsibilities, and acceptable use rules for all students and visitors using TNPSC Aspirant Orbit. By accessing or using our study materials, MCQ practice modules, mock tests, previous year papers, or support services, you agree to follow these guidelines.',
    ],
  },
  {
    id: 'account-responsibility',
    title: '2. Student Account & Session Responsibilities',
    paragraphs: [
      'Student accounts are authenticated through verified Google Sign-In and are intended strictly for personal, individual exam preparation.',
    ],
    bullets: [
      'Keep your Google account credentials secure and do not share your account access with other individuals.',
      'TNPSC Aspirant Orbit enforces single active device session protection to safeguard your account and learning records.',
      'Provide accurate profile details such as your target TNPSC exam group so analytics and study recommendations remain accurate.',
    ],
  },
  {
    id: 'acceptable-use',
    title: '3. Acceptable Use & Content Integrity',
    paragraphs: [
      'All study notes, curated MCQ sets, mock tests, and platform interfaces on TNPSC Aspirant Orbit are provided for personal educational preparation.',
    ],
    bullets: [
      'Do not scrape, bulk-download, redistribute, resell, or publicly mirror platform MCQs, mock tests, or proprietary study materials.',
      'Do not attempt to bypass authentication, subscription controls, rate limits, or security protections.',
      'Do not upload malicious files, scripts, or inappropriate content through Help Center support attachments.',
    ],
  },
  {
    id: 'exam-conduct',
    title: '4. Fair Practice & Performance Analytics',
    paragraphs: [
      'MCQ Practice, Mock Tests, Mark List, and Performance Analytics are designed to give you an honest measurement of your TNPSC exam readiness. Automated bots, scripted test submissions, or attempts to manipulate assessment records are strictly prohibited.',
    ],
  },
  {
    id: 'support-conduct',
    title: '5. Help Center & Support Communication',
    paragraphs: [
      'When contacting TNPSC Aspirant Orbit Support through the Help Center chat widget, students are expected to communicate respectfully and submit genuine academic, account, payment, or technical inquiries. Abusive language, spam, or repeated fraudulent tickets may result in support or account restrictions.',
    ],
  },
  {
    id: 'subscriptions',
    title: '6. Subscription & Plan Access',
    paragraphs: [
      'Free and paid subscription plans grant access to designated features for the active subscription period. Attempting to share paid accounts across multiple users or circumvent plan access checks violates this User Policy and may lead to suspension.',
    ],
  },
  {
    id: 'enforcement',
    title: '7. Policy Enforcement & Updates',
    paragraphs: [
      'TNPSC Aspirant Orbit reserves the right to investigate suspected violations and restrict or suspend accounts that breach this User Policy. We may update this policy periodically to reflect platform improvements or legal requirements, and continued use of the platform constitutes acceptance of the latest version.',
    ],
  },
]

const UserPolicyPage: React.FC = () => {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1160px',
        margin: '0 auto',
        padding: '1.5rem clamp(1rem, 2.5vw, 2rem) 3rem',
        boxSizing: 'border-box',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="glass"
        style={{
          padding: 'clamp(1.35rem, 3vw, 2.25rem)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.2rem',
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldCheck size={24} style={{ color: '#ffd700' }} />
            <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)', fontWeight: 800, color: '#f8fafc' }}>
              User Policy
            </h1>
          </div>
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6 }}>
            Acceptable use guidelines, student responsibilities, and community standards for TNPSC Aspirant Orbit.
          </p>
        </div>

        {USER_POLICY_SECTIONS.map((section) => (
          <div
            key={section.id}
            style={{
              padding: '1.15rem 1.25rem',
              borderRadius: '14px',
              background: 'rgba(15, 23, 42, 0.68)',
              border: '1px solid rgba(148, 163, 184, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>{section.title}</h2>
            {section.paragraphs.map((p, idx) => (
              <p key={idx} style={{ margin: 0, fontSize: '0.87rem', color: '#cbd5e1', lineHeight: 1.65 }}>
                {p}
              </p>
            ))}
            {section.bullets && (
              <ul
                style={{
                  margin: '0.15rem 0 0',
                  paddingLeft: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  fontSize: '0.86rem',
                  color: '#cbd5e1',
                  lineHeight: 1.6,
                }}
              >
                {section.bullets.map((b, idx) => (
                  <li key={idx}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

export default UserPolicyPage
