import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  HelpCircle,
  Copy,
  Check,
  Printer,
  FileText,
  Sparkles,
  Layers,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Target,
  Zap,
} from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { apiFetch } from '../utils/api'
import './StudyNotesPage.css'

interface StudyNoteRecord {
  id: number
  category: string
  unitId: number
  classId: number | null
  subject: string
  lessonTitle: string
  topic?: string
  language: string
  title: string
  content: string
  contentHtml?: string | null
  tags?: any
  status: string
  sourceReference?: string | null
  createdAt?: string
  updatedAt?: string
}

interface ParsedSection {
  number: number
  key: string
  titleEn: string
  titleTa: string
  icon: React.ReactNode
  rawText: string
  oneLiners?: { num: number; text: string; page?: string }[]
  tableData?: { headers: string[]; rows: string[][] } | null
  bullets?: string[]
}

const SECTION_CONFIGS: Record<number, { titleEn: string; titleTa: string }> = {
  1: {
    titleEn: 'Important One-Liner Notes',
    titleTa: 'முக்கிய ஒருவரி குறிப்புகள்',
  },
  2: {
    titleEn: 'Authors and Literary Works',
    titleTa: 'நூல்கள் மற்றும் ஆசிரியர்கள்',
  },
  3: {
    titleEn: 'Important Facts',
    titleTa: 'முக்கிய தேர்வு உண்மைகள்',
  },
  4: {
    titleEn: 'Classifications and Tables',
    titleTa: 'வகைப்பாடுகள் மற்றும் அட்டவணைகள்',
  },
  5: {
    titleEn: 'TNPSC Exam-Oriented Facts',
    titleTa: 'TNPSC தேர்வு மையக் குறிப்புகள்',
  },
  6: {
    titleEn: 'Quick Revision',
    titleTa: 'விரைவு மீள்பார்வை',
  },
}

function getSectionIcon(secNum: number) {
  switch (secNum) {
    case 1:
      return <FileText size={18} />
    case 2:
      return <BookOpen size={18} />
    case 3:
      return <Sparkles size={18} />
    case 4:
      return <Layers size={18} />
    case 5:
      return <Target size={18} />
    case 6:
      return <Zap size={18} />
    default:
      return <FileText size={18} />
  }
}

function parseMarkdownTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'))

  if (lines.length < 2) return null

  const headers = lines[0]
    .split('|')
    .slice(1, -1)
    .map((h) => h.trim())

  const rows: string[][] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.replace(/[\s|:-]/g, '') === '') continue // separator row
    const cols = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
    if (cols.length > 0) rows.push(cols)
  }

  return rows.length > 0 ? { headers, rows } : null
}

function parseOneLiners(text: string): { num: number; text: string; page?: string }[] {
  const lines = text.split('\n')
  const items: { num: number; text: string; page?: string }[] = []
  let current: { num: number; text: string; page?: string } | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = trimmed.match(/^(\d+)[\.\)]\s*(.+)$/)
    if (match) {
      if (current) items.push(current)
      let factText = match[2].trim()
      let pageRef: string | undefined

      const pageMatch = factText.match(/[-–—]?\s*\[(Page|பக்கம்|பக்கங்கள்|Pages)[\s:]*([0-9\s,\-]+)\]/i)
      if (pageMatch) {
        pageRef = pageMatch[2].trim()
        factText = factText.replace(pageMatch[0], '').trim()
      }

      current = {
        num: parseInt(match[1], 10),
        text: factText,
        page: pageRef,
      }
    } else if (current) {
      current.text += ' ' + trimmed
    }
  }

  if (current) items.push(current)
  return items
}

function parseBulletPoints(text: string): string[] {
  const lines = text.split('\n')
  const bullets: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      bullets.push(trimmed.slice(2).trim())
    }
  }
  return bullets
}

function parseNoteSections(content: string): {
  preamble: string
  blockquote: string | null
  sections: ParsedSection[]
} {
  const normalized = content.replace(/\r\n/g, '\n')

  // Split on "SECTION X: [Title]"
  const sectionRegex = /(?:^|\n)(SECTION\s+(\d+)\s*:\s*([^\n]+))/gi
  const matches = [...normalized.matchAll(sectionRegex)]

  if (matches.length === 0) {
    return {
      preamble: '',
      blockquote: null,
      sections: [
        {
          number: 1,
          key: 'section-main',
          titleEn: 'Comprehensive Study Notes',
          titleTa: 'முழுமையான பாடக் குறிப்புகள்',
          icon: <FileText size={18} />,
          rawText: normalized,
          tableData: parseMarkdownTable(normalized),
          oneLiners: parseOneLiners(normalized),
          bullets: parseBulletPoints(normalized),
        },
      ],
    }
  }

  const preambleRaw = normalized.substring(0, matches[0].index || 0).trim()
  let blockquote: string | null = null
  let cleanPreamble = preambleRaw

  const bqMatch = preambleRaw.match(/^>\s*(.+)$/m)
  if (bqMatch) {
    blockquote = bqMatch[1].trim()
    cleanPreamble = preambleRaw.replace(/^>\s*(.+)$/m, '').trim()
  }

  const sections: ParsedSection[] = []

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    const secNum = parseInt(m[2], 10) || i + 1
    const rawTitle = m[3].trim()
    const startIndex = (m.index || 0) + m[0].length
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : normalized.length
    const body = normalized.substring(startIndex, endIndex).trim()

    const cfg = SECTION_CONFIGS[secNum] || {
      titleEn: rawTitle,
      titleTa: rawTitle,
    }

    const tableData = parseMarkdownTable(body)
    const oneLiners = secNum === 1 ? parseOneLiners(body) : undefined
    const bullets = secNum !== 1 && !tableData ? parseBulletPoints(body) : undefined

    sections.push({
      number: secNum,
      key: `section-${secNum}`,
      titleEn: cfg.titleEn,
      titleTa: cfg.titleTa,
      icon: getSectionIcon(secNum),
      rawText: body,
      oneLiners: oneLiners && oneLiners.length > 0 ? oneLiners : undefined,
      tableData,
      bullets: bullets && bullets.length > 0 ? bullets : undefined,
    })
  }

  return { preamble: cleanPreamble, blockquote, sections }
}

function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>
    }
    return <span key={idx}>{part}</span>
  })
}

const StudyNotesPage: React.FC = () => {
  const { group, unitId, subjectId, lessonTitle, classId: paramClassId } = useParams<{
    group: string
    unitId?: string
    subjectId?: string
    lessonTitle: string
    classId?: string
  }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isTamil } = useLanguage()

  const rawTitle = lessonTitle || searchParams.get('lessonTitle') || ''
  const decodedLessonTitle = decodeURIComponent(rawTitle)

  const queryClassId = searchParams.get('classId')
  const effectiveClassId = paramClassId || (queryClassId && !isNaN(Number(queryClassId)) ? queryClassId : '')

  // Language filter: 'all' | 'tamil' | 'english'
  const [selectedLang, setSelectedLang] = useState<'all' | 'tamil' | 'english'>('all')
  const [notes, setNotes] = useState<StudyNoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Normalize category
  const normalizedCategory = useMemo(() => {
    if (!group) return 'group2_2a'
    const g = group.toLowerCase()
    if (g === 'group1') return 'group1'
    if (g === 'group2' || g === 'group2a' || g === 'group2_2a') return 'group2_2a'
    if (g === 'group4' || g === 'vao' || g === 'group4_vao') return 'group4_vao'
    return g
  }, [group])

  // Normalize subject
  const effectiveSubject = useMemo(() => {
    if (subjectId && subjectId !== 'all') return subjectId
    if (normalizedCategory === 'group1') return 'general-studies'
    return 'general-tamil'
  }, [subjectId, normalizedCategory])

  const fetchNotes = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('category', normalizedCategory)
      if (unitId && !isNaN(Number(unitId))) params.set('unitId', unitId)
      if (effectiveClassId) params.set('classId', effectiveClassId)
      params.set('subject', effectiveSubject)
      params.set('lesson', decodedLessonTitle)
      if (selectedLang !== 'all') {
        params.set('language', selectedLang)
        params.set('strictLanguage', 'true')
      }
      params.set('limit', '50')

      const res = await apiFetch(`/api/notes?${params.toString()}`)
      const data = await res.json()
      if (res.ok && data.status === 'success' && Array.isArray(data.data)) {
        setNotes(data.data)
      } else {
        setNotes([])
      }
    } catch (err: any) {
      console.error('Failed to fetch study notes:', err)
      setError(err.message || 'Failed to connect to notes server')
      setNotes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotes()
  }, [normalizedCategory, unitId, effectiveClassId, effectiveSubject, decodedLessonTitle, selectedLang])

  const groupDisplayName = useMemo(() => {
    if (normalizedCategory === 'group1') return isTamil ? 'TNPSC குரூப் 1' : 'TNPSC Group 1'
    if (normalizedCategory === 'group4_vao') return isTamil ? 'TNPSC குரூப் 4 & VAO' : 'TNPSC Group 4 & VAO'
    return isTamil ? 'TNPSC குரூப் 2 & 2A' : 'TNPSC Group 2 & 2A'
  }, [normalizedCategory, isTamil])

  const subjectDisplayName = useMemo(() => {
    const s = effectiveSubject.toLowerCase()
    if (s.includes('tamil')) return isTamil ? 'பொதுத் தமிழ்' : 'General Tamil'
    if (s.includes('english')) return isTamil ? 'பொது ஆங்கிலம்' : 'General English'
    if (s.includes('aptitude')) return isTamil ? 'திறனறிவும் மனக்கணக்கும்' : 'Aptitude & Mental Ability'
    return isTamil ? 'பொது அறிவியல் & பொது அறிவு' : 'General Studies'
  }, [effectiveSubject, isTamil])

  const classDisplayName = useMemo(() => {
    if (!effectiveClassId) return null
    return isTamil ? `${effectiveClassId}-ஆம் வகுப்பு` : `${effectiveClassId}th Standard`
  }, [effectiveClassId, isTamil])

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1)
    } else {
      if (normalizedCategory === 'group1') {
        navigate(`/materials/group1/unit/${unitId || 1}/class/${effectiveClassId || 6}`)
      } else if (normalizedCategory === 'group4_vao') {
        navigate(`/materials/group4/${effectiveSubject}/unit/${unitId || 1}/class/${effectiveClassId || 6}`)
      } else {
        navigate(`/materials/group2/${effectiveSubject}/unit/${unitId || 1}/class/${effectiveClassId || 6}`)
      }
    }
  }

  const handlePracticeClick = () => {
    const g = normalizedCategory.includes('group1') ? 'group1' : normalizedCategory.includes('group4') ? 'group4' : 'group2'
    const c = effectiveClassId || 'all'
    const u = unitId || '1'
    navigate(
      `/study-materials/practice?group=${g}&subjectId=${effectiveSubject}&classId=${c}&unitId=${u}&lessonTitle=${encodeURIComponent(
        decodedLessonTitle
      )}`
    )
  }

  const handleCopyNotes = () => {
    if (notes.length === 0) return
    const textToCopy = notes.map((n) => `--- ${n.title} ---\n\n${n.content}`).join('\n\n')
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  // Active note (primary)
  const activeNote = notes[0]
  const parsedActiveContent = useMemo(() => {
    if (!activeNote || !activeNote.content) return null
    return parseNoteSections(activeNote.content)
  }, [activeNote])

  return (
    <div className="study-notes-page">
      {/* Hero Header */}
      <header className="study-notes-hero">
        <div className="study-notes-hero-bg">
          <div className="study-notes-orb study-notes-orb-1" />
          <div className="study-notes-orb study-notes-orb-2" />
        </div>

        <div className="study-notes-hero-content">
          {/* Breadcrumb Bar */}
          <nav className="study-notes-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">{isTamil ? 'முகப்பு' : 'Home'}</Link>
            <span className="study-notes-breadcrumb-sep">/</span>
            <Link to="/materials/group2/general-tamil">{isTamil ? 'பாடத்திட்டம்' : 'Study Materials'}</Link>
            <span className="study-notes-breadcrumb-sep">/</span>
            <span>{groupDisplayName}</span>
            <span className="study-notes-breadcrumb-sep">/</span>
            <span>{subjectDisplayName}</span>
            {classDisplayName && (
              <>
                <span className="study-notes-breadcrumb-sep">/</span>
                <span>{classDisplayName}</span>
              </>
            )}
            {unitId && (
              <>
                <span className="study-notes-breadcrumb-sep">/</span>
                <span>{isTamil ? `அலகு ${unitId}` : `Unit ${unitId}`}</span>
              </>
            )}
            <span className="study-notes-breadcrumb-sep">/</span>
            <span className="study-notes-breadcrumb-active">{decodedLessonTitle}</span>
          </nav>

          {/* Badges / Meta */}
          <div className="study-notes-meta-bar">
            <span className="study-meta-pill study-meta-pill-gold">
              <BookOpen size={13} />
              <span>{isTamil ? 'பாடக் குறிப்புகள்' : 'Study Notes'}</span>
            </span>
            <span className="study-meta-pill study-meta-pill-blue">
              <Layers size={13} />
              <span>{groupDisplayName}</span>
            </span>
            <span className="study-meta-pill">
              <span>{subjectDisplayName}</span>
            </span>
            {classDisplayName && (
              <span className="study-meta-pill study-meta-pill-emerald">
                <GraduationCap size={13} />
                <span>{classDisplayName}</span>
              </span>
            )}
            {unitId && (
              <span className="study-meta-pill">
                <span>{isTamil ? `அலகு ${unitId}` : `Unit ${unitId}`}</span>
              </span>
            )}
          </div>

          {/* Lesson Title */}
          <h1 className="study-notes-title">{decodedLessonTitle}</h1>

          {/* Source Reference Callout */}
          {activeNote?.sourceReference && (
            <div className="study-notes-source-callout">
              <BookOpen size={16} style={{ flexShrink: 0 }} />
              <span>
                <strong>{isTamil ? 'பாடநூல் ஆதாரம்:' : 'Textbook Reference:'}</strong> {activeNote.sourceReference}
              </span>
            </div>
          )}

          {/* Action Bar */}
          <div className="study-notes-actions-bar">
            <div className="study-notes-actions-left">
              <button className="study-btn study-btn-secondary" onClick={handleBack}>
                <ArrowLeft size={16} />
                <span>{isTamil ? 'பாடத்திற்குத் திரும்பு' : 'Back to Lesson'}</span>
              </button>

              <button className="study-btn study-btn-primary" onClick={handlePracticeClick}>
                <HelpCircle size={16} />
                <span>{isTamil ? 'இப்பாட வினாக்களைப் பயிற்சி செய்க' : 'Practice Lesson MCQs'}</span>
              </button>
            </div>

            <div className="study-notes-actions-right">
              {/* Language Switcher */}
              <div className="study-lang-switch">
                <button
                  className={`study-lang-pill ${selectedLang === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedLang('all')}
                  title="View all notes"
                >
                  {isTamil ? 'அனைத்தும்' : 'All'}
                </button>
                <button
                  className={`study-lang-pill ${selectedLang === 'tamil' ? 'active' : ''}`}
                  onClick={() => setSelectedLang('tamil')}
                  title="Filter Tamil notes"
                >
                  தமிழ்
                </button>
                <button
                  className={`study-lang-pill ${selectedLang === 'english' ? 'active' : ''}`}
                  onClick={() => setSelectedLang('english')}
                  title="Filter English notes"
                >
                  English
                </button>
              </div>

              <button className="study-btn study-btn-gold-outline" onClick={handleCopyNotes} disabled={notes.length === 0}>
                {copied ? <Check size={15} style={{ color: '#10b981' }} /> : <Copy size={15} />}
                <span>{copied ? (isTamil ? 'நகலெடுக்கப்பட்டது!' : 'Copied!') : isTamil ? 'நகலெடு' : 'Copy'}</span>
              </button>

              <button className="study-btn study-btn-secondary" onClick={() => window.print()} title="Print or Save PDF">
                <Printer size={15} />
                <span>{isTamil ? 'அச்சிடு' : 'Print'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Nav bar (Jump to Section) */}
      {parsedActiveContent && parsedActiveContent.sections.length > 1 && (
        <div className="study-quick-nav-bar">
          <div className="study-quick-nav">
            {parsedActiveContent.sections.map((sec) => (
              <a key={sec.key} href={`#${sec.key}`} className="study-quick-pill">
                <span>{isTamil ? `§ ${sec.number}. ${sec.titleTa}` : `§ ${sec.number}. ${sec.titleEn}`}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="study-notes-container">
        {loading ? (
          <div className="study-state-card glass">
            <Loader2 size={42} className="study-state-icon animate-spin" />
            <h2 className="study-state-title">{isTamil ? 'பாடக் குறிப்புகள் ஏற்றப்படுகிறது...' : 'Loading Study Notes...'}</h2>
            <p className="study-state-desc">
              {isTamil
                ? 'அதிகாரப்பூர்வ சமச்சீர் கல்வி பாடநூல் அடிப்படையிலான தேர்வு ஒருவரி குறிப்புகள் மீட்டெடுக்கப்படுகின்றன.'
                : 'Retrieving official Samacheer Kalvi examination one-liner notes.'}
            </p>
          </div>
        ) : error ? (
          <div className="study-state-card glass">
            <AlertCircle size={44} style={{ color: '#ef4444', margin: '0 auto 1.25rem' }} />
            <h2 className="study-state-title" style={{ color: '#ef4444' }}>
              {isTamil ? 'ஏற்றுவதில் பிழை ஏற்பட்டது' : 'Failed to Load Study Notes'}
            </h2>
            <p className="study-state-desc">{error}</p>
            <button className="study-btn study-btn-primary" onClick={fetchNotes} style={{ margin: '0 auto' }}>
              <RotateCcw size={15} />
              <span>{isTamil ? 'மீண்டும் முயற்சிக்க' : 'Retry'}</span>
            </button>
          </div>
        ) : notes.length === 0 ? (
          <div className="study-state-card glass">
            <BookOpen size={50} style={{ opacity: 0.45, margin: '0 auto 1.25rem', color: '#ffd700' }} />
            <h2 className="study-state-title">{isTamil ? 'பாடக் குறிப்புகள் இன்னும் சேர்க்கப்படவில்லை' : 'No Study Notes Available'}</h2>
            <p className="study-state-desc">
              {isTamil
                ? `இந்த பாடத்திற்கான (${decodedLessonTitle}) பாடக் குறிப்புகள் நிர்வாகி ஒப்புதலுக்குப் பின் வெளியிடப்படும்.`
                : `Official study notes for this lesson (${decodedLessonTitle}) are currently being curated and published by subject experts.`}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="study-btn study-btn-secondary" onClick={handleBack}>
                <ArrowLeft size={15} />
                <span>{isTamil ? 'பாடப் பட்டியலுக்குத் திரும்பு' : 'Back to Lessons'}</span>
              </button>
              <button className="study-btn study-btn-primary" onClick={handlePracticeClick}>
                <HelpCircle size={15} />
                <span>{isTamil ? 'பயிற்சி வினாக்களைத் தொடங்க' : 'Practice Lesson MCQs'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
            {/* If multiple notes exist, show note tabs or stacked cards */}
            {notes.map((note, noteIdx) => {
              const parsed = parseNoteSections(note.content)

              return (
                <div key={note.id || noteIdx} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                  {/* Note Preamble / Callout */}
                  {parsed.blockquote && (
                    <blockquote className="notes-blockquote">
                      {renderFormattedText(parsed.blockquote)}
                    </blockquote>
                  )}

                  {/* Render 6 Structured Sections */}
                  {parsed.sections.map((sec) => (
                    <section key={sec.key} id={sec.key} className="study-section-card">
                      <header className="study-section-header">
                        <div className="study-section-title-wrap">
                          <div className="study-section-icon-box">{sec.icon}</div>
                          <div>
                            <h2 className="study-section-title">
                              {isTamil ? `பகுதி ${sec.number}: ${sec.titleTa}` : `Section ${sec.number}: ${sec.titleEn}`}
                            </h2>
                          </div>
                        </div>

                        {sec.oneLiners && (
                          <span className="study-section-count-badge">
                            {sec.oneLiners.length} {isTamil ? 'ஒருவரி குறிப்புகள்' : 'One-Liners'}
                          </span>
                        )}
                        {sec.tableData && (
                          <span className="study-section-count-badge">
                            {sec.tableData.rows.length} {isTamil ? 'வரிசைகள்' : 'Rows'}
                          </span>
                        )}
                      </header>

                      <div className="study-section-body">
                        {/* 1. One-Liner Fact Cards (Section 1) */}
                        {sec.oneLiners && sec.oneLiners.length > 0 ? (
                          <div className="one-liners-grid">
                            {sec.oneLiners.map((item) => (
                              <div key={item.num} className="one-liner-fact-card">
                                <span className="fact-num-circle">{item.num}</span>
                                <div className="fact-text-content">
                                  {renderFormattedText(item.text)}
                                  {item.page && (
                                    <span className="fact-page-badge">
                                      <BookOpen size={11} />
                                      <span>
                                        {isTamil ? 'பக்கம்' : 'Page'} {item.page}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : sec.tableData ? (
                          /* 2. Structured Markdown Table (Sections 2, 4, 6) */
                          <div className="table-responsive-wrapper">
                            <table className="notes-markdown-table">
                              <thead>
                                <tr>
                                  {sec.tableData.headers.map((h, hIdx) => (
                                    <th key={hIdx}>{renderFormattedText(h)}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sec.tableData.rows.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {row.map((col, cIdx) => (
                                      <td key={cIdx}>{renderFormattedText(col)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : sec.bullets && sec.bullets.length > 0 ? (
                          /* 3. Bullet Facts List (Sections 3, 5) */
                          <div className="bullet-facts-list">
                            {sec.bullets.map((b, bIdx) => (
                              <div key={bIdx} className="bullet-fact-item">
                                <CheckCircle2 size={16} className="bullet-fact-icon" />
                                <div className="bullet-fact-text">{renderFormattedText(b)}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          /* 4. Fallback text rendering with formatting */
                          <div
                            style={{
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.85,
                              fontSize: '1rem',
                              color: '#e2e8f0',
                            }}
                          >
                            {renderFormattedText(sec.rawText)}
                          </div>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default StudyNotesPage
