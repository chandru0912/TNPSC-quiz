import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'
import { apiFetch } from '../utils/api'
import './Group1Lessons.css'

const StudyNotesPage = () => {
  const { group, unitId, subjectId, lessonTitle } = useParams<{
    group: string
    unitId?: string
    subjectId?: string
    lessonTitle: string
  }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isTamil } = useLanguage()
  
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const chapter = searchParams.get('chapter') || ''
  const chapterNum = searchParams.get('chapterNum') || ''
  const langParam = searchParams.get('lang')
  const effectiveLang = langParam || (isTamil ? 'tamil' : 'english')
  
  const decodedLessonTitle = decodeURIComponent(lessonTitle || '')
  
  useEffect(() => {
    const fetchNotes = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (group) {
          // Normalize group names
          let cat = group.toLowerCase()
          if (cat === 'group1') params.set('category', 'group1')
          else if (cat === 'group2' || cat === 'group2a' || cat === 'group2_2a') params.set('category', 'group2_2a')
          else if (cat === 'group4' || cat === 'vao' || cat === 'group4_vao') params.set('category', 'group4_vao')
          else params.set('category', cat)
        }
        if (unitId && !isNaN(Number(unitId))) params.set('unitId', unitId)
        if (subjectId) params.set('subject', subjectId)
        params.set('lesson', decodedLessonTitle)
        params.set('language', effectiveLang)
        params.set('limit', '100')
        
        const res = await apiFetch(`/api/notes?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'success' && Array.isArray(data.data)) {
            setNotes(data.data)
          } else {
            setNotes([])
          }
        } else {
          setNotes([])
        }
      } catch (err: any) {
        console.error('Failed to fetch study notes:', err)
        setError(err.message)
        setNotes([])
      } finally {
        setLoading(false)
      }
    }
    fetchNotes()
  }, [group, unitId, subjectId, decodedLessonTitle, effectiveLang])
  
  const getGroupName = () => {
    if (group === 'group1') return isTamil ? 'குழு 1' : 'Group 1'
    if (group === 'group2' || group === 'group2a' || group === 'group2_2a') return isTamil ? 'குழு 2 / 2A' : 'Group 2 / 2A'
    if (group === 'group4' || group === 'vao' || group === 'group4_vao') return isTamil ? 'குழு 4 / VAO' : 'Group 4 / VAO'
    return group
  }
  
  return (
    <div className="group1-lessons-page" style={{ width: '100%', maxWidth: '100%' }}>
      <div className="lessons-header" style={{ width: '100%', maxWidth: '100%' }}>
        <div className="lessons-header-bg">
          <div className="lessons-header-orb lessons-header-orb-1" />
          <div className="lessons-header-orb lessons-header-orb-2" />
          <div className="lessons-header-grid" />
        </div>
        <div className="lessons-header-content" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          <button className="back-to-unit-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={18} />
            <span>{isTamil ? 'பின்னால் செல்ல' : 'Back to Lesson'}</span>
          </button>
          <div className="lessons-hero">
            <div className="lessons-badge">
              <BookOpen size={16} />
              <span>{isTamil ? 'பாடக் குறிப்புகள்' : 'Read Study Notes'}</span>
            </div>
            <h1 className="lessons-title">
              <span className="lessons-title-main">{decodedLessonTitle}</span>
            </h1>
            <p className="lessons-subtitle">
              {getGroupName()}
              {unitId && ` • ${isTamil ? 'அலகு' : 'Unit'} ${unitId}`}
              {chapter && ` • ${chapter}`}
              {chapterNum && ` (${isTamil ? 'பாடம்' : 'Lesson'} ${chapterNum})`}
            </p>
          </div>
        </div>
      </div>

      <div className="lessons-main" style={{ width: '100%', maxWidth: '100%' }}>
        <div className="lessons-container" style={{ maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          {loading ? (
            <div className="lessons-empty-state glass">
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem', color: 'var(--gold-primary)' }} />
              <p>{isTamil ? 'பாடக் குறிப்புகள் ஏற்றப்படுகிறது...' : 'Loading study notes...'}</p>
            </div>
          ) : error ? (
            <div className="lessons-empty-state glass">
              <p style={{ color: '#ef4444' }}>{error}</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="lessons-empty-state glass">
              <BookOpen size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)', opacity: 0.5 }} />
              <h3>{isTamil ? 'பாடக் குறிப்புகள் கிடைக்கவில்லை' : 'No Study Notes Available'}</h3>
              <p>{isTamil ? 'இந்த பாடத்திற்கு பாடக் குறிப்புகள் இன்னும் சேர்க்கப்படவில்லை.' : 'Study notes for this lesson have not been added yet.'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>
              {notes.map((note, idx) => (
                <article key={note.id || idx} className="chapter-block glass" style={{ padding: '2.5rem', width: '100%' }}>
                  <header style={{ marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.25rem' }}>
                    <h2 style={{ margin: 0, fontSize: '2rem', color: 'var(--gold-primary)', lineHeight: 1.3 }}>
                      {note.title || decodedLessonTitle}
                    </h2>
                    <div style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                      {note.language === 'tamil' ? 'தமிழ்' : 'English'}
                    </div>
                  </header>
                  <div 
                    style={{ 
                      whiteSpace: 'pre-wrap', 
                      lineHeight: 2, 
                      fontSize: '1.08rem',
                      color: 'var(--text-primary)',
                      wordBreak: 'break-word',
                      maxWidth: '100%'
                    }}
                  >
                    {note.content}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StudyNotesPage
