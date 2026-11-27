import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Award,
  BarChart3,
  BookOpen,
  Compass,
  FileText,
  GraduationCap,
  Landmark,
  Target,
  Trophy,
} from 'lucide-react'

const EXAM_TRACKS = [
  {
    icon: Landmark,
    title: 'TNPSC Group 1',
    description:
      'Degree-standard Prelims and Mains preparation covering General Studies, Aptitude, and Mental Ability for Deputy Collector, DSP, and District Officer services.',
  },
  {
    icon: Trophy,
    title: 'TNPSC Group 2 & Group 2A',
    description:
      'Structured preparation for both Interview and Non-Interview posts including Sub-Registrar, Municipal Commissioner, and Assistant Section Officer roles.',
  },
  {
    icon: Award,
    title: 'TNPSC Group 4 & VAO',
    description:
      'SSLC-standard syllabus mastery mapped lesson-by-lesson to Samacheer Kalvi textbooks for Village Administrative Officer, Junior Assistant, and Typist vacancies.',
  },
]

const PLATFORM_PILLARS = [
  {
    icon: BookOpen,
    title: 'Study Materials & Samacheer Kalvi Textbook Library',
    description:
      'Organized class-wise and subject-wise study notes alongside Samacheer Kalvi textbooks from 6th to 12th Standard in both Tamil and English mediums.',
  },
  {
    icon: Target,
    title: 'MCQ Practice & Full-Length Mock Tests',
    description:
      'Unit-wise and lesson-wise MCQ practice with detailed explanations, paired with timed full-length mock test simulations built to mirror real TNPSC exam conditions.',
  },
  {
    icon: FileText,
    title: 'Previous Year Question Papers',
    description:
      'Curated archive of TNPSC Previous Year Question Papers with interactive test mode so aspirants can study recurring exam patterns and benchmark readiness.',
  },
  {
    icon: BarChart3,
    title: 'Student Performance Analytics & Progress Tracking',
    description:
      'Real-time Mark List, accuracy breakdowns, subject-wise mastery metrics, and continuous progress tracking to identify weak topics and improve scores steadily.',
  },
]

const AboutUsPage: React.FC = () => {
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
          gap: '1.75rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
            <GraduationCap size={26} style={{ color: '#ffd700' }} />
            <h1 style={{ margin: 0, fontSize: 'clamp(1.45rem, 2.6vw, 1.95rem)', fontWeight: 800, color: '#f8fafc' }}>
              About TNPSC Study Hub
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: '0.94rem', color: '#cbd5e1', lineHeight: 1.7 }}>
            TNPSC Study Hub is a dedicated online exam preparation platform built specifically for Tamil Nadu Public
            Service Commission (TNPSC) aspirants. We bring together syllabus-aligned study materials, Samacheer Kalvi
            textbooks, topic-wise MCQ practice, previous year question papers, full-length mock tests, and detailed
            performance analytics inside one unified learning portal.
          </p>
        </div>

        {/* Mission & Vision */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem',
          }}
        >
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '14px',
              background: 'rgba(15, 23, 42, 0.72)',
              border: '1px solid rgba(255, 215, 0, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ffd700', fontWeight: 700, fontSize: '0.95rem' }}>
              <Target size={18} />
              <span>Our Mission</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.65 }}>
              To make structured, high-quality TNPSC exam preparation accessible to every aspirant across Tamil Nadu
              through syllabus-accurate resources, disciplined practice tools, and clear progress insights.
            </p>
          </div>

          <div
            style={{
              padding: '1.25rem',
              borderRadius: '14px',
              background: 'rgba(15, 23, 42, 0.72)',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ffd700', fontWeight: 700, fontSize: '0.95rem' }}>
              <Compass size={18} />
              <span>Our Vision</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.65 }}>
              To empower Tamil Nadu civil service aspirants with a focused, distraction-free study environment that
              transforms consistent daily practice into exam-day confidence and top ranks.
            </p>
          </div>
        </div>

        {/* Exams Covered */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: '#ffd700' }}>
            TNPSC Exams We Support
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '0.9rem',
            }}
          >
            {EXAM_TRACKS.map((exam) => {
              const Icon = exam.icon
              return (
                <div
                  key={exam.title}
                  style={{
                    padding: '1.15rem',
                    borderRadius: '14px',
                    background: 'rgba(15, 23, 42, 0.68)',
                    border: '1px solid rgba(148, 163, 184, 0.16)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontWeight: 700, fontSize: '0.95rem' }}>
                    <Icon size={17} style={{ color: '#ffd700' }} />
                    <span>{exam.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    {exam.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Platform Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 800, color: '#ffd700' }}>
            What You Get on TNPSC Study Hub
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '0.9rem',
            }}
          >
            {PLATFORM_PILLARS.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  style={{
                    padding: '1.15rem',
                    borderRadius: '14px',
                    background: 'rgba(15, 23, 42, 0.68)',
                    border: '1px solid rgba(148, 163, 184, 0.16)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontWeight: 700, fontSize: '0.94rem' }}>
                    <Icon size={17} style={{ color: '#ffd700', flexShrink: 0 }} />
                    <span>{item.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            borderRadius: '14px',
            background: 'rgba(255, 215, 0, 0.08)',
            border: '1px solid rgba(255, 215, 0, 0.26)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem',
          }}
        >
          <span style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600 }}>
            Ready to start your TNPSC preparation journey?
          </span>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <Link to="/materials" className="btn btn-primary" style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}>
              Explore Study Materials
            </Link>
            <Link to="/practice" className="btn btn-secondary" style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}>
              Start MCQ Practice
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default AboutUsPage
