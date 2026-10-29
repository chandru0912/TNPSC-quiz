import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  ChevronRight,
  Clock,
  Calculator,
  Layers,
  Sparkles,
  HelpCircle,
  Languages,
  Globe2,
} from 'lucide-react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  group1GeneralStudiesUnits,
  getTotalGSQuestions,
  getTotalGSChapters,
  getTotalGSLessons,
  group1AptitudeUnits,
} from '../data/group1SyllabusData'
import { useLanguage } from '../context/LanguageContext'
import LanguageSwitch from '../components/LanguageSwitch'
import { UI_TRANSLATIONS } from '../utils/languageData'
import './StudyMaterials.css'

type GroupId = 'group1' | 'group2_2a' | 'group4_vao'

const normalizeGroup = (val: unknown): GroupId | null => {
  if (typeof val !== 'string') return null
  const clean = val.toLowerCase().trim()
  if (clean === 'group1') return 'group1'
  if (clean === 'group2_2a' || clean === 'group2' || clean === 'group-2') return 'group2_2a'
  if (clean === 'group4_vao' || clean === 'group4' || clean === 'group-4') return 'group4_vao'
  return null
}

const getStoredGroup = (): GroupId => {
  try {
    const saved = sessionStorage.getItem('tnpsc_selected_group')
    const normalized = normalizeGroup(saved)
    if (normalized) return normalized
  } catch {}
  return 'group1'
}

const StudyMaterials = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const { language, isTamil } = useLanguage()
  const t = UI_TRANSLATIONS.studyMaterials[language]

  const rawUrlParam = searchParams.get('group') || searchParams.get('tab')
  const groupFromUrl = normalizeGroup(rawUrlParam)
  const groupFromState = normalizeGroup((location.state as any)?.selectedGroup || (location.state as any)?.fromGroup || (location.state as any)?.tab)

  // Derive active group directly from URL search params, router state, or session storage
  const selectedGroup: GroupId = groupFromUrl || groupFromState || getStoredGroup()

  useEffect(() => {
    if (selectedGroup) {
      try {
        sessionStorage.setItem('tnpsc_selected_group', selectedGroup)
      } catch {}
    }
  }, [selectedGroup])

  const groups = [
    { id: 'group1' as const, name: isTamil ? 'TNPSC குரூப் 1' : 'TNPSC Group 1' },
    { id: 'group2_2a' as const, name: isTamil ? 'TNPSC குரூப் 2 & 2A' : 'TNPSC Group 2 & 2A' },
    { id: 'group4_vao' as const, name: isTamil ? 'TNPSC குரூப் 4 & VAO' : 'TNPSC Group 4' },
  ]

  const handleGroupChange = (group: GroupId) => {
    setSearchParams({ group }, { replace: true })
    try {
      sessionStorage.setItem('tnpsc_selected_group', group)
    } catch {}
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  // Group 1 Metrics
  const gsTotalQuestions = getTotalGSQuestions() // 175
  const gsTotalChapters = getTotalGSChapters() // 28
  const gsTotalLessons = getTotalGSLessons() // 109
  const aptTotalQuestions = group1AptitudeUnits.reduce((acc, u) => acc + u.questionCount, 0) // 25

  return (
    <div className="materials">
      <div className="materials-container">
        <motion.div
          className="materials-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="materials-header-top">
            <h1 className="materials-title">
              <BookOpen size={32} />
              <span>
                {isTamil ? (
                  <>
                    பாடக்குறிப்புகள் & <span className="gradient-text">பாடத்திட்டம்</span>
                  </>
                ) : (
                  <>
                    Study Materials & <span className="gradient-text">Syllabus</span>
                  </>
                )}
              </span>
            </h1>
            <LanguageSwitch variant="section" forceVisible={true} />
          </div>
          <p className="materials-subtitle">{t.pageSubtitle}</p>
        </motion.div>

        {/* Main Category Tabs */}
        <motion.div
          className="group-tabs glass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {groups.map((group) => (
            <button
              key={group.id}
              className={`group-tab ${selectedGroup === group.id ? 'active' : ''}`}
              onClick={() => handleGroupChange(group.id)}
            >
              {group.name}
            </button>
          ))}
        </motion.div>

        {/* ============================================================== */}
        {/* GROUP 1 VIEW                                                  */}
        {/* ============================================================== */}
        {selectedGroup === 'group1' ? (
          <motion.div
            className="group1-cards-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Card 1: General Studies */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group1/general-studies')}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">{isTamil ? 'பகுதி A • பட்டப்படிப்புத் தரம்' : 'Part A • Degree Standard'}</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  {gsTotalQuestions} {isTamil ? 'வினாக்கள்' : 'Questions'}
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <BookOpen size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">{isTamil ? 'பொது அறிவு (General Studies)' : 'General Studies'}</h2>
                  <span className="group1-card-sub">
                    {group1GeneralStudiesUnits.length} {isTamil ? 'பாடத்திட்ட அலகுகள்' : 'Distinct Syllabus Units'}
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                {isTamil
                  ? 'பொது அறிவியல், இந்தியப் புவியியல், இந்திய வரலாறு & கலாச்சாரம், இந்திய ஆட்சியியல், இந்தியப் பொருளாதாரம் & தமிழ்நாடு நிர்வாகம் மற்றும் தமிழ் மரபு உள்ளடக்கிய பட்டப்படிப்புத் தரம்.'
                  : 'Comprehensive degree standard syllabus covering General Science, Indian Geography, History & Culture of India, Indian Polity, Indian Economy & TN Administration, and Tamil Society Heritage.'}
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    {isTamil ? 'அலகுகள்:' : 'Units:'} <strong>{group1GeneralStudiesUnits.length}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    {isTamil ? 'அத்தியாயங்கள்:' : 'Chapters:'} <strong>{gsTotalChapters}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    {isTamil ? 'பாடங்கள்:' : 'Lessons:'} <strong>{gsTotalLessons}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>{isTamil ? 'பொது அறிவு அலகுகளை ஆராய்க (6 அலகுகள்)' : 'Explore General Studies (6 Units)'}</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 2: Aptitude */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group1/aptitude')}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">{isTamil ? 'பகுதி B • பத்தாம் வகுப்புத் தரம் (SSLC)' : 'Part B • SSLC Standard'}</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  {aptTotalQuestions} {isTamil ? 'வினாக்கள்' : 'Questions'}
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Calculator size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">{isTamil ? 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும்' : 'Aptitude and Mental Ability'}</h2>
                  <span className="group1-card-sub">
                    {group1AptitudeUnits.length} {isTamil ? 'அலகுகள் (கணிதம் & தர்க்கவியல்)' : 'Units (Aptitude & Reasoning)'}
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                {isTamil
                  ? 'பத்தாம் வகுப்புத் தரத்திலான சுருக்குதல், விழுக்காடு, மீ.பொ.வ, மீ.சி.ம, விகிதம், தனிவட்டி, கூட்டுவட்டி, பரப்பளவு மற்றும் தர்க்கக் கணக்குகள்.'
                  : 'SSLC standard quantitative aptitude and logical reasoning modules including Simplification, HCF & LCM, Ratio, Percentage, Simple & Compound Interest, Puzzles, Dice, and Visual Reasoning.'}
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    {isTamil ? 'அலகுகள்:' : 'Units:'} <strong>{group1AptitudeUnits.length}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Clock size={16} />
                  <span>
                    {isTamil ? 'தரம்:' : 'Standard:'} <strong>{isTamil ? 'பத்தாம் வகுப்பு (SSLC)' : 'SSLC (10th)'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <HelpCircle size={16} />
                  <span>
                    {isTamil ? 'மதிப்பெண்:' : 'Weightage:'} <strong>{aptTotalQuestions} {isTamil ? 'மதிப்பெண்கள்' : 'Marks'}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>{isTamil ? 'திறனறிவுப் பாடங்களை ஆராய்க' : 'Explore Aptitude & Reasoning'}</span>
                <ChevronRight size={18} />
              </div>
            </div>
          </motion.div>
        ) : selectedGroup === 'group2_2a' ? (
          /* ============================================================== */
          /* GROUP 2 & 2A VIEW: 4 SUBJECTS IN EXACT REQUIRED ORDER          */
          /* 1. General Studies                                            */
          /* 2. Aptitude and Mental Ability                                */
          /* 3. General English                                            */
          /* 4. General Tamil                                              */
          /* ============================================================== */
          <motion.div
            className="group1-cards-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Card 1: General Studies */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group2/general-studies', { state: { selectedGroup: 'group2_2a' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">{isTamil ? 'பகுதி A • பட்டப்படிப்புத் தரம்' : 'Part A • Degree Standard'}</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  75 {isTamil ? 'வினாக்கள்' : 'Questions'}
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Globe2 size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">{isTamil ? 'பொது அறிவு (General Studies)' : 'General Studies'}</h2>
                  <span className="group1-card-sub">
                    {isTamil ? '6 பாடத்திட்ட அலகுகள் (பட்டப்படிப்புத் தரம் • முதல்நிலைத் தேர்வு)' : '6 Syllabus Units (Degree Standard • Preliminary Exam)'}
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                {isTamil
                  ? 'அதிகாரப்பூர்வ TNPSC குரூப் 2 & 2A முதல்நிலைத் தேர்வுப் பாடத்திட்டம்: பொது அறிவியல், இந்தியப் புவியியல், இந்திய வரலாறு மற்றும் இந்திய தேசிய இயக்கம், ஆட்சியியல், பொருளாதாரம் மற்றும் தமிழ் சமூகப் பண்பாடு.'
                  : 'Official TNPSC Group 2 & 2A preliminary syllabus covering General Science, Geography of India, History & Culture of India and INM, Indian Polity, Indian Economy & TN Administration, and Tamil Society Heritage.'}
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    {isTamil ? 'அலகுகள்:' : 'Units:'} <strong>{isTamil ? '6 அலகுகள்' : '6 Units'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    {isTamil ? 'வகுப்புகள்:' : 'Classes:'} <strong>{isTamil ? '6 முதல் 12 வரை' : '6th to 12th'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    {isTamil ? 'மதிப்பெண்:' : 'Weightage:'} <strong>{isTamil ? '75 மதிப்பெண்கள்' : '75 Marks'}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>{isTamil ? 'பொது அறிவு அலகுகளை ஆராய்க (6 அலகுகள்)' : 'Explore General Studies (6 Units & Classes)'}</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 2: Aptitude and Mental Ability */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group2/aptitude', { state: { selectedGroup: 'group2_2a' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">{isTamil ? 'பகுதி B • பத்தாம் வகுப்புத் தரம் (SSLC)' : 'Part B • SSLC Standard'}</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  25 {isTamil ? 'வினாக்கள்' : 'Questions'}
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Calculator size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">{isTamil ? 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும்' : 'Aptitude and Mental Ability'}</h2>
                  <span className="group1-card-sub">
                    {isTamil ? '2 அலகுகள் (பத்தாம் வகுப்புத் தரம்)' : '2 Units (Aptitude & Mental Ability • SSLC Standard)'}
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                {isTamil
                  ? 'பத்தாம் வகுப்புத் தரத்திலான சுருக்குதல், விழுக்காடு, மீ.பொ.வ, மீ.சி.ம, விகிதம் & விகிதாச்சாரம், தனிவட்டி, கூட்டுவட்டி, பரப்பளவு, காலம் மற்றும் வேலை, புதிர்கள் மற்றும் பகடை.'
                  : 'SSLC standard quantitative aptitude and logical reasoning modules including Simplification, Percentage, HCF & LCM, Ratio & Proportion, Simple & Compound Interest, Area & Volume, Time and Work, Puzzles, Dice, and Visual Reasoning.'}
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    {isTamil ? 'அலகுகள்:' : 'Units:'} <strong>{isTamil ? '2 அலகுகள்' : '2 Units'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Clock size={16} />
                  <span>
                    {isTamil ? 'தரம்:' : 'Standard:'} <strong>{isTamil ? 'பத்தாம் வகுப்பு (SSLC)' : 'SSLC (10th)'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <HelpCircle size={16} />
                  <span>
                    {isTamil ? 'மதிப்பெண்:' : 'Weightage:'} <strong>{isTamil ? '25 மதிப்பெண்கள்' : '25 Marks'}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>{isTamil ? 'திறனறிவுப் பாடங்களை ஆராய்க' : 'Explore Aptitude and Mental Ability'}</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 3: General English */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group2/general-english', { state: { selectedGroup: 'group2_2a' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">{isTamil ? 'பகுதி C • பத்தாம் வகுப்புத் தரம் (SSLC)' : 'Part C • SSLC Standard'}</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  100 {isTamil ? 'வினாக்கள்' : 'Questions'}
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Languages size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">{isTamil ? 'பொது ஆங்கிலம் (General English)' : 'General English'}</h2>
                  <span className="group1-card-sub">
                    {isTamil ? '7 அலகுகள் (இலக்கணம், சொற்களஞ்சியம் & இலக்கியம்)' : '7 Units (Grammar, Vocabulary & Literature • SSLC Standard)'}
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                {isTamil
                  ? 'பத்தாம் வகுப்புத் தரத்திலான ஆங்கில இலக்கணம், சொற்களஞ்சியம், வாசித்தல் புரிதல், மொழிபெயர்ப்பு மற்றும் பாடநூல் இலக்கியப் பகுதிகள்.'
                  : 'Comprehensive SSLC standard syllabus covering English Grammar, Vocabulary, Writing Skills, Technical Terms, Reading Comprehension, Translation, and Renowned Literary Works & Figures.'}
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    {isTamil ? 'அலகுகள்:' : 'Units:'} <strong>{isTamil ? '7 அலகுகள்' : '7 Units'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    {isTamil ? 'வகுப்புகள்:' : 'Classes:'} <strong>{isTamil ? '6 முதல் 12 வரை' : '6th to 12th'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    {isTamil ? 'மதிப்பெண்:' : 'Weightage:'} <strong>{isTamil ? '100 மதிப்பெண்கள்' : '100 Marks'}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>{isTamil ? 'பொது ஆங்கிலத்தை ஆராய்க (7 அலகுகள்)' : 'Explore General English (7 Units & Classes)'}</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 4: General Tamil */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group2/general-tamil', { state: { selectedGroup: 'group2_2a' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">{isTamil ? 'பகுதி C • பத்தாம் வகுப்புத் தரம் (SSLC)' : 'Part C • SSLC Standard'}</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  100 {isTamil ? 'வினாக்கள்' : 'Questions'}
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Sparkles size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">{isTamil ? 'பொதுத் தமிழ்' : 'General Tamil (பொதுத் தமிழ்)'}</h2>
                  <span className="group1-card-sub">
                    {isTamil ? '7 அலகுகள் (இலக்கணம், இலக்கியம், தமிழ் அறிஞர்கள்)' : '7 Units (இலக்கணம், இலக்கியம், தமிழ் அறிஞர்கள் • SSLC Standard)'}
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                {isTamil
                  ? 'விரிவான பத்தாம் வகுப்பு தரத்திலான பொதுத் தமிழ் பாடத்திட்டம்: இலக்கணம், சொல்லகராதி, எழுதும் திறன், கலைச் சொற்கள், வாசித்தல் புரிதல், மொழிபெயர்ப்பு மற்றும் இலக்கியமும் தமிழறிஞர்களும்.'
                  : 'Comprehensive SSLC standard syllabus covering Tamil Grammar, Vocabulary, Writing Skills, Technical Terms, Reading Comprehension, Translation, and Literature & Tamil Scholars.'}
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    {isTamil ? 'அலகுகள்:' : 'Units:'} <strong>{isTamil ? '7 அலகுகள்' : '7 Units'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    {isTamil ? 'வகுப்புகள்:' : 'Classes:'} <strong>{isTamil ? '6 முதல் 12 வரை' : '6th to 12th'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    {isTamil ? 'மதிப்பெண்:' : 'Weightage:'} <strong>{isTamil ? '100 மதிப்பெண்கள்' : '100 Marks'}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>{isTamil ? 'பொதுத் தமிழை ஆராய்க (7 அலகுகள்)' : 'Explore General Tamil (7 Units & Classes)'}</span>
                <ChevronRight size={18} />
              </div>
            </div>
          </motion.div>
        ) : (
          /* ============================================================== */
          /* GROUP 4 & VAO VIEW: 4 SUBJECTS IN EXACT REQUIRED ORDER          */
          /* 1. General Studies                                             */
          /* 2. Aptitude and Mental Ability                                 */
          /* 3. General Tamil (பொதுத் தமிழ்)                               */
          /* 4. General English                                             */
          /* ============================================================== */
          <motion.div
            className="group1-cards-grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Card 1: General Studies */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group4/general-studies', { state: { selectedGroup: 'group4_vao' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">{isTamil ? 'பகுதி A • பத்தாம் வகுப்புத் தரம் (SSLC)' : 'Part A • SSLC Standard'}</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  75 {isTamil ? 'வினாக்கள்' : 'Questions'}
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Globe2 size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">{isTamil ? 'பொது அறிவு (General Studies)' : 'General Studies'}</h2>
                  <span className="group1-card-sub">
                    {isTamil ? '6 பாடத்திட்ட அலகுகள் (பத்தாம் வகுப்புத் தரம்)' : '6 Syllabus Units (SSLC Standard • Single Paper)'}
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                {isTamil
                  ? 'அதிகாரப்பூர்வ TNPSC குரூப் 4 பொது அறிவுப் பாடத்திட்டம்: பொது அறிவியல், இந்திய மற்றும் தமிழ்நாடு புவியியல், வரலாறு, இந்திய தேசிய இயக்கம், ஆட்சியியல், பொருளாதாரம் மற்றும் தமிழ்நாட்டின் விடுதலைப் போராட்ட வரலாறு.'
                  : 'Official TNPSC Group 4 General Studies syllabus covering General Science, Geography of India & TN, History & Culture of India and INM, Indian Polity, Indian Economy & TN Dev Admin, and Tamil Nadu History/Heritage/Movements.'}
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    {isTamil ? 'அலகுகள்:' : 'Units:'} <strong>{isTamil ? '6 அலகுகள்' : '6 Units'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    {isTamil ? 'வகுப்புகள்:' : 'Classes:'} <strong>{isTamil ? '6 முதல் 10 வரை' : '6th to 10th'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    {isTamil ? 'மதிப்பெண்:' : 'Weightage:'} <strong>{isTamil ? '75 மதிப்பெண்கள்' : '75 Marks'}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>{isTamil ? 'பொது அறிவு அலகுகளை ஆராய்க (6 அலகுகள்)' : 'Explore General Studies (6 Units & Classes)'}</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 2: Aptitude and Mental Ability */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group4/aptitude', { state: { selectedGroup: 'group4_vao' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">{isTamil ? 'பகுதி B • பத்தாம் வகுப்புத் தரம் (SSLC)' : 'Part B • SSLC Standard'}</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  25 {isTamil ? 'வினாக்கள்' : 'Questions'}
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Calculator size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">{isTamil ? 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும்' : 'Aptitude and Mental Ability'}</h2>
                  <span className="group1-card-sub">
                    {isTamil ? '2 அலகுகள் (பத்தாம் வகுப்புத் தரம்)' : '2 Units (Aptitude & Reasoning • SSLC Standard)'}
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                {isTamil
                  ? 'பத்தாம் வகுப்புத் தரத்திலான சுருக்குதல், விழுக்காடு, மீ.பொ.வ, மீ.சி.ம, விகிதம் & விகிதாச்சாரம், தனிவட்டி, கூட்டுவட்டி, பரப்பளவு, காலம் மற்றும் வேலை, புதிர்கள் மற்றும் பகடை.'
                  : 'SSLC standard quantitative aptitude and logical reasoning modules including Simplification, Percentage, HCF & LCM, Ratio & Proportion, Simple & Compound Interest, Area & Volume, Time and Work, Puzzles, Dice, Visual Reasoning, and Number Series.'}
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    {isTamil ? 'அலகுகள்:' : 'Units:'} <strong>{isTamil ? '2 அலகுகள்' : '2 Units'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Clock size={16} />
                  <span>
                    {isTamil ? 'தரம்:' : 'Standard:'} <strong>{isTamil ? 'பத்தாம் வகுப்பு (SSLC)' : 'SSLC (10th)'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <HelpCircle size={16} />
                  <span>
                    {isTamil ? 'மதிப்பெண்:' : 'Weightage:'} <strong>{isTamil ? '25 மதிப்பெண்கள்' : '25 Marks'}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>{isTamil ? 'திறனறிவுப் பாடங்களை ஆராய்க' : 'Explore Aptitude and Mental Ability'}</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 3: General Tamil */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group4/general-tamil', { state: { selectedGroup: 'group4_vao' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">{isTamil ? 'பகுதி C • பத்தாம் வகுப்புத் தரம் (SSLC)' : 'Part C • SSLC Standard'}</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  100 {isTamil ? 'வினாக்கள்' : 'Questions'}
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <BookOpen size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">{isTamil ? 'பொதுத் தமிழ்' : 'General Tamil (பொதுத் தமிழ்)'}</h2>
                  <span className="group1-card-sub">
                    {isTamil ? '7 அலகுகள் (தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு)' : '7 Units (Tamil Eligibility & Scoring Test)'}
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                {isTamil
                  ? 'SSLC தரத்திலான தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு பாடத்திட்டம்: இலக்கணம், சொல்லகராதி, எழுதும் திறன், கலைச் சொற்கள், வாசித்தல் புரிந்து கொள்ளும் திறன், எளிய மொழி பெயர்ப்பு, இலக்கியம் மற்றும் தமிழ் அறிஞர்களும் தமிழ்த்தொண்டும்.'
                  : 'SSLC standard syllabus for Tamil Eligibility and Scoring Test: Grammar, Vocabulary, Writing Skills, Technical Terms, Reading Comprehension, Translation, Literature, and Tamil Scholars & Contributions.'}
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    {isTamil ? 'அலகுகள்:' : 'Units:'} <strong>{isTamil ? '7 அலகுகள்' : '7 Units'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    {isTamil ? 'வகுப்புகள்:' : 'Classes:'} <strong>{isTamil ? '6 முதல் 10 வரை' : '6th to 10th'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    {isTamil ? 'மதிப்பெண்:' : 'Weightage:'} <strong>{isTamil ? '100 மதிப்பெண்கள்' : '100 Marks'}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>{isTamil ? 'பொதுத் தமிழை ஆராய்க (7 அலகுகள்)' : 'Explore General Tamil (7 Units & Classes)'}</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 4: General English */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group4/general-english', { state: { selectedGroup: 'group4_vao' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">{isTamil ? 'பகுதி C • பத்தாம் வகுப்புத் தரம் (SSLC)' : 'Part C • SSLC Standard'}</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  100 {isTamil ? 'வினாக்கள்' : 'Questions'}
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Languages size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">{isTamil ? 'பொது ஆங்கிலம் (General English)' : 'General English'}</h2>
                  <span className="group1-card-sub">
                    {isTamil ? '7 அலகுகள் (இலக்கணம், சொற்களஞ்சியம் & இலக்கியம்)' : '7 Units (Grammar, Vocabulary & Literature • SSLC Standard)'}
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                {isTamil
                  ? 'பத்தாம் வகுப்புத் தரத்திலான பொது ஆங்கிலப் பாடத்திட்டம்: இலக்கணம், சொற்களஞ்சியம், எழுதும் திறன், வாசித்தல் புரிதல் மற்றும் அரசு பாடநூல் செய்யுள் & உரைநடை பகுதிகள்.'
                  : 'SSLC standard syllabus (for Differently Abled Candidates) covering Grammar, Vocabulary, Writing Skills, Technical Terms, Reading Comprehension, Translation, and 30 Prescribed Poems & 26 Prose Works with school textbook mappings.'}
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    {isTamil ? 'அலகுகள்:' : 'Units:'} <strong>{isTamil ? '7 அலகுகள்' : '7 Units'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    {isTamil ? 'வகுப்புகள்:' : 'Classes:'} <strong>{isTamil ? '6 முதல் 10 வரை' : '6th to 10th'}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    {isTamil ? 'மதிப்பெண்:' : 'Weightage:'} <strong>{isTamil ? '100 மதிப்பெண்கள்' : '100 Marks'}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>{isTamil ? 'பொது ஆங்கிலத்தை ஆராய்க (7 அலகுகள்)' : 'Explore General English (7 Units & Classes)'}</span>
                <ChevronRight size={18} />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default StudyMaterials
