import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  HelpCircle,
  Printer,
  FileText,
  Layers,
  AlertCircle,
  RotateCcw,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { apiFetch } from '../utils/api'
import { cleanTamilUnicodeText } from '../utils/tamilUnicodeCleaner'
import { getLessonsForSelection } from '../data/unifiedSyllabusRegistry'
import { buildCanonicalLessonCode } from '../utils/lessonMapping'
import { GoogleDrivePdfViewer, type GoogleDriveMaterialItem } from '../components/GoogleDrivePdfViewer'
import { TamilStudyNotesRenderer } from '../components/TamilStudyNotesRenderer'
import './StudyNotesPage.css'

interface StudyNoteRecord {
  id: number
  category: string
  unitId: number
  classId: number | null
  subject: string
  term?: string | null
  lessonId?: string | null
  lessonNumber?: string | null
  lessonCode?: string | null
  lessonTitle: string
  topic?: string
  topicOrder?: number
  topicId?: string | null
  subtopics?: string[] | string | null
  generationStatus?: string
  language: string
  noteFormat?: 'short' | 'full'
  title: string
  content: string
  contentHtml?: string | null
  tags?: any
  status: string
  sourceReference?: string | null
  coverageReport?: {
    totalLessonPages: number
    processedPages: number[]
    pendingPages: number[]
    topicsIdentified: string[]
    topicsCovered: string[]
    missingTopics: string[]
    processingErrors: string[]
    completionPercentage: number
    isComplete: boolean
    statusVerdict: string
  } | null
  topics?: string[] | null
  createdAt?: string
  updatedAt?: string
}

interface TopicDisplayCard {
  id: string | number
  topicOrder: number
  topicId?: string | null
  topicTitle: string
  subtopics: string[]
  content: string
  noteFormat?: 'short' | 'full'
  tableData?: { headers: string[]; rows: string[][] } | null
  bullets?: string[]
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
    titleEn: '1. Topic Notes',
    titleTa: '1. முதன்மைப் பாடக் குறிப்புகள்',
  },
  2: {
    titleEn: '2. Detailed Concepts',
    titleTa: '2. விரிவான பாடக் கருத்துகள்',
  },
  3: {
    titleEn: '3. Educational Classifications',
    titleTa: '3. கல்வி வகைப்பாடுகள் & அட்டவணைகள்',
  },
  4: {
    titleEn: '4. Summary & Review',
    titleTa: '4. முக்கியக் குறிப்புகள் & மீள்பார்வை',
  },
}

function getSectionIcon(_secNum: number, title?: string) {
  const t = (title || '').toLowerCase()
  if (t.includes('பாடத்திட்ட') || t.includes('syllabus')) return <Layers size={18} />
  if (t.includes('அட்டவணை') || t.includes('table') || t.includes('ஒப்பீடு') || t.includes('வகைப்பாடு')) return <Layers size={18} />
  if (t.includes('சொல்லும்') || t.includes('இலக்கணம்') || t.includes('விளக்கம்') || t.includes('கருத்து')) return <BookOpen size={18} />
  if (t.includes('ஆசிரியர்') || t.includes('வரலாறு')) return <FileText size={18} />
  return <BookOpen size={18} />
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

  // Split on:
  // 1. "## 1. பாடத் தலைப்பு" / "## 1. LESSON TITLE"
  // 2. "SECTION 1: ..." / "பிரிவு 1: ..."
  // 3. "### 📋 பாடநூல் முழுமை ஆய்வு அறிக்கை" / "### 📋 Textbook Coverage & Quality Audit"
  const sectionRegex = /(?:^|\n)(?:##\s*(\d+(?:\.\d+)*)[\.:\s]+([^\n]+)|##\s+([^\n]+)|(?:SECTION|பிரிவு)\s*(\d+)[\.:\s]*([^\n]+)|###\s*📋?\s*([^\n]*(?:ஆய்வு அறிக்கை|Quality Audit|Coverage Report)[^\n]*))/gi;
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
    let secNum = parseInt(m[1] || m[4] || `${i + 1}`, 10)
    if (isNaN(secNum) || secNum === 0) {
      secNum = i + 1
    }
    const startIndex = (m.index || 0) + m[0].length
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : normalized.length
    const body = normalized.substring(startIndex, endIndex).trim()

    const isNumberedHeading = Boolean(m[1] && m[2]);
    const headingText = isNumberedHeading ? `${m[1]}. ${m[2].trim()}` : (m[2] || m[3] || m[5] || m[6] || '').trim();

    // STRICT STUDENT PORTAL RULES: Filter out any internal audit reports, MCQs, or unwanted metadata sections
    if (/ஆய்வு\s*அறிக்கை|Quality\s*Audit|Coverage\s*Report|பாடநூல்\s*உறுதிமொழி|Textbook\s*Guarantee/i.test(headingText)) {
      continue;
    }
    if (/MCQ|வினாக்கள்|மாதிரி\s*வினாக்கள்|Practice\s*Questions|Format\s*&?\s*Language|வடிவமைப்பு\s*&?\s*மொழி/i.test(headingText)) {
      continue;
    }

    const numMatch = headingText.match(/^(\d+)[\.:]/);
    if (numMatch) {
      secNum = parseInt(numMatch[1], 10);
    }

    const cfg = SECTION_CONFIGS[secNum];
    const resolvedTitle = headingText || cfg?.titleEn || `Topic ${secNum}`;
    const resolvedTitleTa = cfg?.titleTa || resolvedTitle;

    const tableData = parseMarkdownTable(body)
    const parsedBul = parseBulletPoints(body)

    sections.push({
      number: secNum,
      key: `section-${secNum}-${i}`,
      titleEn: resolvedTitle,
      titleTa: resolvedTitleTa,
      icon: getSectionIcon(secNum, resolvedTitle),
      rawText: body,
      tableData,
      bullets: !tableData && parsedBul.length > 0 && !body.includes('\n\n') ? parsedBul : undefined,
    })
  }

  return { preamble: cleanPreamble, blockquote, sections }
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

  const queryLessonId = searchParams.get('lessonId') || ''
  const queryLessonNumber = searchParams.get('lessonNumber') || ''
  const queryLessonCode = searchParams.get('lessonCode') || ''
  const queryTerm = searchParams.get('term') || 'Term 1'

  const queryClassId = searchParams.get('classId')
  const effectiveClassId = paramClassId || (queryClassId && !isNaN(Number(queryClassId)) ? queryClassId : '')

  // Language filter: 'all' | 'tamil' | 'english'
  const [selectedLang, setSelectedLang] = useState<'all' | 'tamil' | 'english'>('all')
  // Note Format filter: 'short' | 'full'
  const [activeFormat, setActiveFormat] = useState<'short' | 'full'>('short')
  const [topicSearch, setTopicSearch] = useState('')
  const [notes, setNotes] = useState<StudyNoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [driveMaterial, setDriveMaterial] = useState<GoogleDriveMaterialItem | null>(null)
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false)

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

  // Canonical lesson ID and number resolution
  const canonicalLessonId = useMemo(() => {
    if (queryLessonId) return queryLessonId
    if (effectiveClassId && unitId && decodedLessonTitle) {
      try {
        const lessons = getLessonsForSelection(
          normalizedCategory as any,
          effectiveSubject,
          Number(effectiveClassId),
          Number(unitId)
        )
        const matched = lessons.find(
          (l) =>
            (queryLessonNumber && l.lessonNumber === queryLessonNumber) ||
            l.title === decodedLessonTitle ||
            l.title.toLowerCase() === decodedLessonTitle.toLowerCase() ||
            decodedLessonTitle.includes(l.title) ||
            l.title.includes(decodedLessonTitle)
        )
        return matched?.id || ''
      } catch {
        return ''
      }
    }
    return ''
  }, [queryLessonId, queryLessonNumber, effectiveClassId, unitId, decodedLessonTitle, normalizedCategory, effectiveSubject])

  const canonicalLessonNumber = useMemo(() => {
    if (queryLessonNumber) return queryLessonNumber
    if (effectiveClassId && unitId && decodedLessonTitle) {
      try {
        const lessons = getLessonsForSelection(
          normalizedCategory as any,
          effectiveSubject,
          Number(effectiveClassId),
          Number(unitId)
        )
        const matched = lessons.find(
          (l) =>
            l.id === canonicalLessonId ||
            l.title === decodedLessonTitle ||
            l.title.toLowerCase() === decodedLessonTitle.toLowerCase()
        )
        return matched?.lessonNumber || ''
      } catch {
        return ''
      }
    }
    return ''
  }, [queryLessonNumber, canonicalLessonId, effectiveClassId, unitId, decodedLessonTitle, normalizedCategory, effectiveSubject])

  const canonicalLessonCode = useMemo(() => {
    if (queryLessonCode) return queryLessonCode
    return buildCanonicalLessonCode({
      category: normalizedCategory,
      classId: effectiveClassId || 6,
      subject: effectiveSubject,
      term: queryTerm,
      unitId: unitId || 1,
      lessonNumber: canonicalLessonNumber || '1.1',
      lessonId: canonicalLessonId || undefined,
    })
  }, [queryLessonCode, normalizedCategory, effectiveClassId, effectiveSubject, queryTerm, unitId, canonicalLessonNumber, canonicalLessonId])

  const fetchNotes = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('category', normalizedCategory)
      if (unitId && !isNaN(Number(unitId))) params.set('unitId', unitId)
      if (effectiveClassId) params.set('classId', effectiveClassId)
      params.set('subject', effectiveSubject)
      params.set('term', queryTerm)
      if (canonicalLessonCode) {
        params.set('lessonCode', canonicalLessonCode)
      }
      if (canonicalLessonId) {
        params.set('lessonId', canonicalLessonId)
      }
      if (canonicalLessonNumber) {
        params.set('lessonNumber', canonicalLessonNumber)
      }
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
  }, [normalizedCategory, unitId, effectiveClassId, effectiveSubject, decodedLessonTitle, canonicalLessonId, canonicalLessonNumber, canonicalLessonCode, queryTerm, selectedLang])

  // Fetch associated Google Drive PDF material for this lesson
  useEffect(() => {
    let isCancelled = false
    const fetchDrivePdf = async () => {
      try {
        const params = new URLSearchParams()
        if (canonicalLessonId) {
          params.set('lessonId', canonicalLessonId)
        } else if (effectiveClassId && decodedLessonTitle) {
          params.set('standard', effectiveClassId)
          params.set('search', decodedLessonTitle)
        } else {
          return
        }

        const res = await apiFetch(`/api/drive/materials?${params.toString()}`)
        const json = await res.json()
        if (!isCancelled && res.ok && json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
          setDriveMaterial(json.data[0])
        } else if (!isCancelled) {
          setDriveMaterial(null)
        }
      } catch (err) {
        console.warn('Could not fetch Google Drive PDF material for lesson:', err)
      }
    }

    fetchDrivePdf()
    return () => {
      isCancelled = true
    }
  }, [canonicalLessonId, effectiveClassId, decodedLessonTitle])

  // Published MCQs for this specific lesson
  const [lessonQuestions, setLessonQuestions] = useState<any[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null)

  const fetchLessonQuestions = useCallback(async () => {
    setLoadingQuestions(true)
    try {
      const g = normalizedCategory.includes('group1') ? 'group1' : normalizedCategory.includes('group4') ? 'group4' : 'group2'
      const params = new URLSearchParams()
      params.set('group', g)
      params.set('subjectId', effectiveSubject)
      if (effectiveClassId) params.set('standard', effectiveClassId.toString())
      if (unitId) params.set('unitId', unitId.toString())
      if (canonicalLessonId) params.set('lessonId', canonicalLessonId)
      if (decodedLessonTitle) params.set('lessonTitle', decodedLessonTitle)
      if (selectedLang !== 'all') params.set('language', selectedLang)
      params.set('limit', '50')

      const res = await apiFetch(`/api/study-materials/questions?${params.toString()}`)
      const data = await res.json().catch(() => null)
      if (res.ok && data?.status === 'success' && Array.isArray(data?.data)) {
        setLessonQuestions(data.data)
      } else {
        setLessonQuestions([])
      }
    } catch (err) {
      console.warn('Could not fetch practice questions for study notes:', err)
      setLessonQuestions([])
    } finally {
      setLoadingQuestions(false)
    }
  }, [normalizedCategory, effectiveSubject, effectiveClassId, unitId, canonicalLessonId, decodedLessonTitle, selectedLang])

  useEffect(() => {
    fetchLessonQuestions()
  }, [fetchLessonQuestions])

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
    const lessonIdParam = canonicalLessonId ? `&lessonId=${encodeURIComponent(canonicalLessonId)}` : ''
    navigate(
      `/study-materials/practice?group=${g}&subjectId=${effectiveSubject}&classId=${c}&unitId=${u}&lessonTitle=${encodeURIComponent(
        decodedLessonTitle
      )}${lessonIdParam}`
    )
  }

  const hasShortNotes = useMemo(() => notes.some((n) => (n.noteFormat || 'short') === 'short'), [notes])
  const hasFullNotes = useMemo(() => notes.some((n) => n.noteFormat === 'full'), [notes])

  useEffect(() => {
    if (hasFullNotes && !hasShortNotes) {
      setActiveFormat('full')
    } else if (hasShortNotes && !hasFullNotes) {
      setActiveFormat('short')
    }
  }, [hasShortNotes, hasFullNotes])

  const filteredNotes = useMemo(() => {
    const matching = notes.filter((n) => (n.noteFormat || 'short') === activeFormat)
    return matching.length > 0 ? matching : notes
  }, [notes, activeFormat])

  // Automatic Topic-Wise Separation:
  // Converts database topic records or segments content into individual topic cards
  const displayTopics = useMemo<TopicDisplayCard[]>(() => {
    if (filteredNotes.length === 0) return []

    // 1. If individual topic records exist in filteredNotes (topicOrder >= 1)
    const separatedRecords = filteredNotes.filter((n) => (n.topicOrder || 0) >= 1)
    if (separatedRecords.length > 0) {
      const sorted = [...separatedRecords].sort((a, b) => (a.topicOrder || 0) - (b.topicOrder || 0))
      return sorted.map((n, idx) => {
        const cleaned = cleanTamilUnicodeText(n.content || '')
        const sub = Array.isArray(n.subtopics)
          ? n.subtopics
          : typeof n.subtopics === 'string'
            ? JSON.parse(n.subtopics || '[]')
            : []

        return {
          id: n.id,
          topicOrder: n.topicOrder || idx + 1,
          topicId: n.topicId || (canonicalLessonId ? `${canonicalLessonId}-t${n.topicOrder || idx + 1}` : undefined),
          topicTitle: cleanTamilUnicodeText(n.topic || n.title || `Topic ${n.topicOrder || idx + 1}`),
          subtopics: sub,
          content: cleaned,
          noteFormat: n.noteFormat || activeFormat,
          tableData: parseMarkdownTable(cleaned),
          bullets: parseBulletPoints(cleaned),
        }
      })
    }

    // 2. Fallback: If only a master note exists (topicOrder === 0 or null),
    // automatically segment into separate topic cards so every topic gets its own card!
    const masterNote = filteredNotes.find((n) => !n.topicOrder || n.topicOrder === 0) || filteredNotes[0]
    if (!masterNote || !masterNote.content) return []

    const cleaned = cleanTamilUnicodeText(masterNote.content)
    const parsed = parseNoteSections(cleaned)
    return parsed.sections.map((sec, idx) => ({
      id: `sec-${sec.number}-${idx}`,
      topicOrder: sec.number || idx + 1,
      topicId: canonicalLessonId ? `${canonicalLessonId}-t${sec.number || idx + 1}` : undefined,
      topicTitle: isTamil ? (sec.titleTa || sec.titleEn) : (sec.titleEn || sec.titleTa),
      subtopics: sec.bullets || [],
      content: sec.rawText,
      noteFormat: masterNote.noteFormat || activeFormat,
      tableData: sec.tableData,
      bullets: sec.bullets,
    }))
  }, [filteredNotes, activeFormat, canonicalLessonId, isTamil])

  const filteredTopics = useMemo(() => {
    if (!topicSearch.trim()) return displayTopics
    const q = topicSearch.trim().toLowerCase()
    return displayTopics.filter(
      (t) =>
        t.topicTitle.toLowerCase().includes(q) ||
        t.subtopics.some((st) => st.toLowerCase().includes(q)) ||
        t.content.toLowerCase().includes(q)
    )
  }, [displayTopics, topicSearch])

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

          {/* Lesson Title */}
          <h1 className="study-notes-title">
            {canonicalLessonNumber ? `${canonicalLessonNumber} ${decodedLessonTitle}` : decodedLessonTitle}
          </h1>

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
              {/* Note Format Switcher: Short Notes vs Full Notes */}
              {(hasShortNotes || hasFullNotes || notes.length > 0) && (
                <div className="study-lang-switch">
                  <button
                    className={`study-lang-pill ${activeFormat === 'short' ? 'active' : ''}`}
                    onClick={() => setActiveFormat('short')}
                    title="View concise exam-oriented revision notes"
                  >
                    <span>⚡ {isTamil ? 'சுருக்கக் குறிப்புகள்' : 'Short Notes'}</span>
                  </button>
                  <button
                    className={`study-lang-pill ${activeFormat === 'full' ? 'active' : ''}`}
                    onClick={() => setActiveFormat('full')}
                    title="View comprehensive detailed textbook notes"
                  >
                    <span>📖 {isTamil ? 'முழுப் பாடம்' : 'Full Notes'}</span>
                  </button>
                </div>
              )}

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

              {driveMaterial && (
                <button
                  className="study-btn"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(255, 215, 0, 0.25) 100%)',
                    border: '1px solid rgba(255, 215, 0, 0.45)',
                    color: '#ffd700',
                    fontWeight: 600,
                  }}
                  onClick={() => setIsPdfViewerOpen(true)}
                  title="View Official Textbook PDF from Google Drive"
                >
                  <BookOpen size={15} />
                  <span>{isTamil ? 'பாடநூல் PDF' : 'Official PDF'}</span>
                </button>
              )}

              <button className="study-btn study-btn-secondary" onClick={() => window.print()} title="Print or Save PDF">
                <Printer size={15} />
                <span>{isTamil ? 'அச்சிடு' : 'Print'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Quick Nav bar (Jump to Topic) */}
      {displayTopics.length > 1 && (
        <div className="study-quick-nav-bar">
          <div className="study-quick-nav">
            {displayTopics.map((t) => (
              <a key={t.id} href={`#topic-${t.topicOrder}`} className="study-quick-pill">
                <span>{isTamil ? `§ தலைப்பு ${t.topicOrder}: ${t.topicTitle}` : `§ Topic ${t.topicOrder}: ${t.topicTitle}`}</span>
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
                ? 'அதிகாரப்பூர்வ சமச்சீர் கல்வி பாடநூல் அடிப்படையிலான முழுமையான பாடக் குறிப்புகள் மீட்டெடுக்கப்படுகின்றன.'
                : 'Retrieving official Samacheer Kalvi complete syllabus study notes.'}
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
        ) : displayTopics.length === 0 ? (
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            {/* Topic Filter & Summary Toolbar */}
            <div className="study-topic-search-wrap">
              <div className="study-topic-count-summary">
                <span>
                  {isTamil
                    ? `அதிகாரப்பூர்வ பாடத்திட்டப் பிரிவுகள்: ${filteredTopics.length} / ${displayTopics.length} தலைப்புகள்`
                    : `Syllabus Topic Alignment: ${filteredTopics.length} of ${displayTopics.length} Topics`}
                </span>
              </div>
              <div className="study-topic-search-box">
                <Search size={15} style={{ opacity: 0.6 }} />
                <input
                  type="text"
                  className="study-topic-search-input"
                  placeholder={isTamil ? 'தலைப்பைத் தேடுக...' : 'Search topics in lesson...'}
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                />
                {topicSearch && (
                  <button
                    type="button"
                    onClick={() => setTopicSearch('')}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0 }}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Render Each Topic as its Own Separate Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {filteredTopics.map((topicItem) => (
                <section
                  key={topicItem.id}
                  id={`topic-${topicItem.topicOrder}`}
                  className="study-section-card"
                >
                  {/* Topic Card Header */}
                  <header className="study-section-header">
                    <div className="study-section-title-wrap">
                      <span className="study-topic-order-badge">
                        {isTamil ? `தலைப்பு ${topicItem.topicOrder}` : `Topic ${topicItem.topicOrder}`}
                      </span>
                      <h2 className="study-section-title">
                        {topicItem.topicTitle}
                      </h2>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="study-meta-pill study-meta-pill-gold">
                        {topicItem.noteFormat === 'full'
                          ? (isTamil ? '📖 முழுப் பாடம்' : '📖 Full Notes')
                          : (isTamil ? '⚡ சுருக்கக் குறிப்பு' : '⚡ Short Notes')}
                      </span>
                      {topicItem.tableData && (
                        <span className="study-section-count-badge">
                          {topicItem.tableData.rows.length} {isTamil ? 'வரிசைகள்' : 'Rows'}
                        </span>
                      )}
                    </div>
                  </header>

                  {/* Subtopics Bar (if subtopics exist) */}
                  {topicItem.subtopics && topicItem.subtopics.length > 0 && (
                    <div className="study-subtopics-list">
                      <span className="study-subtopics-label">
                        {isTamil ? 'துணைத் தலைப்புகள்:' : 'Subtopics:'}
                      </span>
                      {topicItem.subtopics.map((st, sIdx) => (
                        <span key={sIdx} className="study-subtopic-tag">
                          <span>🏷️</span>
                          <span>{st}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Topic Card Content */}
                  <div className="study-section-body">
                    <TamilStudyNotesRenderer content={topicItem.content} />
                  </div>

                  {/* Card Footer */}
                  <footer className="study-topic-card-footer">
                    <span className="study-topic-footer-id">
                      {topicItem.topicId ? `ID: ${topicItem.topicId}` : ''}
                    </span>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      style={{ color: '#ffd700', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <ChevronUp size={14} />
                      <span>{isTamil ? 'மேலே செல்க' : 'Top'}</span>
                    </a>
                  </footer>
                </section>
              ))}
            </div>
          </div>
        )}

        {/* Dedicated Lesson Practice Questions Section */}
        {lessonQuestions.length > 0 && (
          <section className="study-section-card" style={{ marginTop: '2rem', border: '1px solid rgba(255, 215, 0, 0.25)' }}>
            <header className="study-section-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="study-section-title-wrap">
                <span className="study-topic-order-badge" style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,165,0,0.2))', color: '#ffd700', borderColor: 'rgba(255,215,0,0.4)' }}>
                  {isTamil ? 'வினா வங்கி' : 'Question Bank'}
                </span>
                <h2 className="study-section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span>{isTamil ? 'பாட மாதிரி வினாக்கள்' : 'Lesson Practice Questions'}</span>
                  <span className="study-meta-pill study-meta-pill-gold" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
                    {loadingQuestions ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Loader2 size={12} className="animate-spin" />
                        {isTamil ? 'ஏற்றுகிறது...' : 'Loading...'}
                      </span>
                    ) : (
                      `${lessonQuestions.length} ${isTamil ? 'வினாக்கள் உள்ளன' : 'Available Questions'}`
                    )}
                  </span>
                </h2>
              </div>
              <button
                className="study-btn study-btn-primary"
                onClick={handlePracticeClick}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              >
                <HelpCircle size={15} />
                <span>{isTamil ? 'ஊடாடும் பயிற்சி தேர்வு' : 'Take Interactive Quiz'}</span>
              </button>
            </header>

            <div className="study-section-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem' }}>
              {lessonQuestions.slice(0, 10).map((q: any, qIdx: number) => (
                <div
                  key={q.id || qIdx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ background: 'rgba(255, 215, 0, 0.15)', color: '#ffd700', borderRadius: '6px', padding: '0.15rem 0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                        Q{qIdx + 1}
                      </span>
                      {q.difficulty && (
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: q.difficulty === 'Hard' ? 'rgba(239, 68, 68, 0.15)' : q.difficulty === 'Medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          color: q.difficulty === 'Hard' ? '#ef4444' : q.difficulty === 'Medium' ? '#f59e0b' : '#10b981',
                        }}>
                          {q.difficulty}
                        </span>
                      )}
                    </div>
                    {q.tag && (
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                        {q.tag}
                      </span>
                    )}
                  </div>

                  <p style={{ color: '#f3f4f6', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '1rem', fontWeight: 500 }}>
                    {cleanTamilUnicodeText(q.question)}
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {q.options && q.options.map((opt: string, optIdx: number) => {
                      const optLabel = String.fromCharCode(65 + optIdx)
                      const isCorrect = q.correctAnswer === optIdx
                      const isExpanded = expandedQuestionId === q.id
                      return (
                        <div
                          key={optIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '6px',
                            background: isExpanded && isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                            border: `1px solid ${isExpanded && isCorrect ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.05)'}`,
                            fontSize: '0.875rem',
                            color: isExpanded && isCorrect ? '#10b981' : 'rgba(255, 255, 255, 0.85)',
                          }}
                        >
                          <span style={{
                            width: '22px',
                            height: '22px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: isExpanded && isCorrect ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                            color: isExpanded && isCorrect ? '#000' : '#fff',
                          }}>
                            {optLabel}
                          </span>
                          <span>{cleanTamilUnicodeText(opt)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedQuestionId(expandedQuestionId === q.id ? null : q.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ffd700',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.25rem 0',
                      }}
                    >
                      {expandedQuestionId === q.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{expandedQuestionId === q.id ? (isTamil ? 'விளக்கத்தை மறை' : 'Hide Explanation') : (isTamil ? 'விடை & விளக்கம் காண்க' : 'Show Answer & Explanation')}</span>
                    </button>
                    {q.sourceReference && (
                      <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                        {q.sourceReference}
                      </span>
                    )}
                  </div>

                  {expandedQuestionId === q.id && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.08)', borderLeft: '3px solid #10b981', borderRadius: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#10b981', marginBottom: '0.25rem' }}>
                        {isTamil ? 'சரியான விடை:' : 'Correct Answer:'} {String.fromCharCode(65 + (q.correctAnswer ?? 0))}
                      </div>
                      {q.explanation && (
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: '1.5', margin: 0 }}>
                          {cleanTamilUnicodeText(q.explanation)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {lessonQuestions.length > 10 && (
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button
                    className="study-btn study-btn-primary"
                    onClick={handlePracticeClick}
                    style={{ margin: '0 auto' }}
                  >
                    <HelpCircle size={15} />
                    <span>{isTamil ? `அனைத்து ${lessonQuestions.length} வினாக்களையும் பயிற்சி செய்ய` : `Practice All ${lessonQuestions.length} Questions`}</span>
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Google Drive PDF Reader Modal for Students */}
      {driveMaterial && (
        <GoogleDrivePdfViewer
          isOpen={isPdfViewerOpen}
          material={driveMaterial}
          onClose={() => setIsPdfViewerOpen(false)}
        />
      )}
    </div>
  )
}

export default StudyNotesPage
