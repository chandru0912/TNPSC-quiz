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

  const rawUrlParam = searchParams.get('group') || searchParams.get('tab')
  const groupFromUrl = normalizeGroup(rawUrlParam)
  const groupFromState = normalizeGroup((location.state as any)?.selectedGroup || (location.state as any)?.fromGroup || (location.state as any)?.tab)

  // Derive active group directly from URL search params, router state, or session storage
  const selectedGroup: GroupId = groupFromUrl || groupFromState || getStoredGroup()

  const groups = [
    { id: 'group1' as const, name: 'TNPSC Group 1' },
    { id: 'group2_2a' as const, name: 'TNPSC Group 2 & 2A' },
    { id: 'group4_vao' as const, name: 'TNPSC Group 4 & VAO' },
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
          <h1 className="materials-title">
            <BookOpen size={32} />
            <span>Study Materials & Syllabus</span>
          </h1>
          <p className="materials-subtitle">
            Comprehensive syllabus-mapped learning modules, study notes, and lesson-wise practice quizzes
          </p>
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
                <span className="group1-part-tag">Part A • Degree Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  {gsTotalQuestions} Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <BookOpen size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">General Studies</h2>
                  <span className="group1-card-sub">
                    {group1GeneralStudiesUnits.length} Distinct Syllabus Units
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                Comprehensive degree standard syllabus covering General Science, Indian Geography,
                History & Culture of India, Indian Polity, Indian Economy & TN Administration, and Tamil Society Heritage.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>{group1GeneralStudiesUnits.length}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    Chapters: <strong>{gsTotalChapters}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    Lessons: <strong>{gsTotalLessons}</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore General Studies (6 Units)</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 2: Aptitude */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group1/aptitude')}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">Part B • SSLC Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  {aptTotalQuestions} Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Calculator size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">Aptitude and Mental Ability</h2>
                  <span className="group1-card-sub">
                    {group1AptitudeUnits.length} Units (Aptitude & Reasoning)
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                SSLC standard quantitative aptitude and logical reasoning modules including Simplification,
                HCF & LCM, Ratio, Percentage, Simple & Compound Interest, Puzzles, Dice, and Visual Reasoning.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>{group1AptitudeUnits.length}</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Clock size={16} />
                  <span>
                    Standard: <strong>SSLC (10th)</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <HelpCircle size={16} />
                  <span>
                    Weightage: <strong>{aptTotalQuestions} Marks</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore Aptitude & Reasoning</span>
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
                <span className="group1-part-tag">Part A • Degree Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  75 Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Globe2 size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">General Studies</h2>
                  <span className="group1-card-sub">
                    6 Syllabus Units (Degree Standard • Preliminary Exam)
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                Official TNPSC Group 2 & 2A preliminary syllabus covering General Science, Geography of India,
                History & Culture of India and INM, Indian Polity, Indian Economy & TN Administration, and Tamil Society Heritage.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>6 Units</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    Classes: <strong>6th to 12th</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    Weightage: <strong>75 Marks</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore General Studies (6 Units & Classes)</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 2: Aptitude and Mental Ability */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group2/aptitude', { state: { selectedGroup: 'group2_2a' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">Part B • SSLC Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  25 Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Calculator size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">Aptitude and Mental Ability</h2>
                  <span className="group1-card-sub">
                    2 Units (Aptitude & Mental Ability • SSLC Standard)
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                SSLC standard quantitative aptitude and logical reasoning modules including Simplification,
                Percentage, HCF & LCM, Ratio & Proportion, Simple & Compound Interest, Area & Volume, Time and Work, Puzzles, Dice, and Visual Reasoning.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>2 Units</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Clock size={16} />
                  <span>
                    Standard: <strong>SSLC (10th)</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <HelpCircle size={16} />
                  <span>
                    Weightage: <strong>25 Marks</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore Aptitude and Mental Ability</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 3: General English */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group2/general-english', { state: { selectedGroup: 'group2_2a' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">Part C • SSLC Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  100 Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Languages size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">General English</h2>
                  <span className="group1-card-sub">
                    7 Units (Grammar, Vocabulary & Literature • SSLC Standard)
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                Comprehensive SSLC standard syllabus covering English Grammar, Vocabulary, Writing Skills,
                Technical Terms, Reading Comprehension, Translation, and Renowned Literary Works & Figures.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>7 Units</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    Classes: <strong>6th to 12th</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    Weightage: <strong>100 Marks</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore General English (7 Units & Classes)</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 4: General Tamil */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group2/general-tamil', { state: { selectedGroup: 'group2_2a' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">Part C • SSLC Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  100 Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Sparkles size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">General Tamil (பொதுத் தமிழ்)</h2>
                  <span className="group1-card-sub">
                    7 Units (இலக்கணம், இலக்கியம், தமிழ் அறிஞர்கள் • SSLC Standard)
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                விரிவான பத்தாம் வகுப்பு தரத்திலான பொதுத் தமிழ் பாடத்திட்டம்: இலக்கணம், சொல்லகராதி, எழுதும் திறன்,
                கலைச் சொற்கள், வாசித்தல் புரிதல், மொழிபெயர்ப்பு மற்றும் இலக்கியமும் தமிழறிஞர்களும்.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>7 Units</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    Classes: <strong>6th to 12th</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    Weightage: <strong>100 Marks</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore General Tamil (7 Units & Classes)</span>
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
                <span className="group1-part-tag">Part A • SSLC Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  75 Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Globe2 size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">General Studies</h2>
                  <span className="group1-card-sub">
                    6 Syllabus Units (SSLC Standard • Single Paper)
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                Official TNPSC Group 4 & VAO General Studies syllabus covering General Science, Geography of India & TN,
                History & Culture of India and INM, Indian Polity, Indian Economy & TN Dev Admin, and Tamil Nadu History/Heritage/Movements.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>6 Units</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    Classes: <strong>6th to 10th</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    Weightage: <strong>75 Marks</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore General Studies (6 Units & Classes)</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 2: Aptitude and Mental Ability */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group4/aptitude', { state: { selectedGroup: 'group4_vao' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">Part B • SSLC Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  25 Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Calculator size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">Aptitude and Mental Ability</h2>
                  <span className="group1-card-sub">
                    2 Units (Aptitude & Reasoning • SSLC Standard)
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                SSLC standard quantitative aptitude and logical reasoning modules including Simplification,
                Percentage, HCF & LCM, Ratio & Proportion, Simple & Compound Interest, Area & Volume, Time and Work, Puzzles, Dice, Visual Reasoning, and Number Series.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>2 Units</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Clock size={16} />
                  <span>
                    Standard: <strong>SSLC (10th)</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <HelpCircle size={16} />
                  <span>
                    Weightage: <strong>25 Marks</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore Aptitude and Mental Ability</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 3: General Tamil */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group4/general-tamil', { state: { selectedGroup: 'group4_vao' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">Part C • SSLC Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  100 Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <BookOpen size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">General Tamil (பொதுத் தமிழ்)</h2>
                  <span className="group1-card-sub">
                    7 அலகுகள் (தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு)
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                SSLC தரத்திலான தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு பாடத்திட்டம்: இலக்கணம், சொல்லகராதி, எழுதும் திறன், கலைச் சொற்கள், வாசித்தல் புரிந்து கொள்ளும் திறன், எளிய மொழி பெயர்ப்பு, இலக்கியம் மற்றும் தமிழ் அறிஞர்களும் தமிழ்த்தொண்டும்.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    அலகுகள்: <strong>7 அலகுகள்</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    வகுப்புகள்: <strong>6 முதல் 10 வரை</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    மதிப்பெண்: <strong>100 வினாக்கள்</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore General Tamil (7 Units & Classes)</span>
                <ChevronRight size={18} />
              </div>
            </div>

            {/* Card 4: General English */}
            <div
              className="group1-main-card glass"
              onClick={() => navigate('/materials/group4/general-english', { state: { selectedGroup: 'group4_vao' } })}
            >
              <div className="group1-card-top">
                <span className="group1-part-tag">Part C • SSLC Standard</span>
                <span className="group1-weightage-pill">
                  <HelpCircle size={14} />
                  100 Questions
                </span>
              </div>

              <div className="group1-card-header">
                <div className="group1-card-icon">
                  <Languages size={28} />
                </div>
                <div className="group1-card-title-group">
                  <h2 className="group1-card-title">General English</h2>
                  <span className="group1-card-sub">
                    7 Units (Grammar, Vocabulary & Literature • SSLC Standard)
                  </span>
                </div>
              </div>

              <p className="group1-card-desc">
                SSLC standard syllabus (for Differently Abled Candidates) covering Grammar, Vocabulary, Writing Skills,
                Technical Terms, Reading Comprehension, Translation, and 30 Prescribed Poems & 26 Prose Works with school textbook mappings.
              </p>

              <div className="group1-card-stats">
                <div className="group1-card-stat">
                  <Layers size={16} />
                  <span>
                    Units: <strong>7 Units</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <BookOpen size={16} />
                  <span>
                    Classes: <strong>6th to 10th</strong>
                  </span>
                </div>
                <div className="group1-card-stat">
                  <Sparkles size={16} />
                  <span>
                    Weightage: <strong>100 Marks</strong>
                  </span>
                </div>
              </div>

              <div className="group1-card-action">
                <span>Explore General English (7 Units & Classes)</span>
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
