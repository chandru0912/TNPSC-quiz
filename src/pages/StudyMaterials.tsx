import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  ChevronRight,
  FileText,
  Clock,
  Filter,
  Calculator,
  Layers,
  Sparkles,
  HelpCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  group1GeneralStudiesUnits,
  getTotalGSQuestions,
  getTotalGSChapters,
  getTotalGSLessons,
  group1AptitudeUnits,
} from '../data/group1SyllabusData'
import './StudyMaterials.css'

interface SubjectItem {
  id: string | number
  name: string
  category: 'group2_2a' | 'group4_vao'
  subCategory?: 'group2' | 'group2a' | 'group4' | 'vao' | 'both'
  scopeTag: string
  description: string
  chapters: number
  lessons: number
  time: string
}

const StudyMaterials = () => {
  const navigate = useNavigate()
  const [selectedGroup, setSelectedGroup] = useState<'group1' | 'group2_2a' | 'group4_vao'>('group1')
  const [subFilter, setSubFilter] = useState<string>('all')

  const groups = [
    { id: 'group1' as const, name: 'TNPSC Group 1' },
    { id: 'group2_2a' as const, name: 'TNPSC Group 2 & 2A' },
    { id: 'group4_vao' as const, name: 'TNPSC Group 4 & VAO' },
  ]

  const subFiltersMap = {
    group1: [],
    group2_2a: [
      { id: 'all', label: 'All Group 2 & 2A Modules' },
      { id: 'group2', label: 'Group 2 (Interview Posts)' },
      { id: 'group2a', label: 'Group 2A (Non-Interview Posts)' },
    ],
    group4_vao: [
      { id: 'all', label: 'All Group 4 & VAO Modules' },
      { id: 'group4', label: 'Group 4 (Junior Assistant / Typist)' },
      { id: 'vao', label: 'VAO (Village Administrative Officer)' },
    ],
  }

  const subjectsOther: SubjectItem[] = [
    // --- TNPSC Group 2 & 2A (Combined & Separable) ---
    {
      id: 'g2-both-1',
      name: 'General Studies (Degree Standard Syllabus)',
      category: 'group2_2a',
      subCategory: 'both',
      scopeTag: 'Group 2 & 2A Common',
      description: 'Core General Studies coverage applicable for both Group 2 (Interview) and 2A (Non-Interview) preliminary stage.',
      chapters: 15,
      lessons: 50,
      time: '28 hrs',
    },
    {
      id: 'g2-both-2',
      name: 'Aptitude & Mental Ability Reasoning (SSLC Standard)',
      category: 'group2_2a',
      subCategory: 'both',
      scopeTag: 'Group 2 & 2A Common',
      description: 'Simplification, Percentage, HCF & LCM, Ratio & Proportion, Simple & Compound Interest, Area & Volume.',
      chapters: 10,
      lessons: 36,
      time: '18 hrs',
    },
    {
      id: 'g2-both-3',
      name: 'General Tamil / Pothu Tamil Eligibility & Scoring',
      category: 'group2_2a',
      subCategory: 'both',
      scopeTag: 'Group 2 & 2A Common',
      description: 'Grammar (இலக்கணம்), Literature (இலக்கியம்), and Tamil Scholars (தமிழ் அறிஞர்களும் தமிழ்த் தொண்டும்).',
      chapters: 14,
      lessons: 45,
      time: '25 hrs',
    },
    {
      id: 'g2-interview-1',
      name: 'Mains Descriptive: Socio-Economic Issues in India & Tamil Nadu',
      category: 'group2_2a',
      subCategory: 'group2',
      scopeTag: 'Group 2 Interview Posts Exclusive',
      description: 'Poverty, unemployment, child labour, women empowerment schemes, and welfare schemes of Government of Tamil Nadu.',
      chapters: 9,
      lessons: 28,
      time: '19 hrs',
    },
    {
      id: 'g2-interview-2',
      name: 'Mains Descriptive: State Administration & Current National Affairs',
      category: 'group2_2a',
      subCategory: 'group2',
      scopeTag: 'Group 2 Interview Posts Exclusive',
      description: 'Organizational structure of State Government, Secretariat, Directorate, District Administration, and state commissions.',
      chapters: 8,
      lessons: 26,
      time: '17 hrs',
    },
    {
      id: 'g2a-noninterview-1',
      name: 'Group 2A: Speed Accuracy Drills & Data Interpretation',
      category: 'group2_2a',
      subCategory: 'group2a',
      scopeTag: 'Group 2A Non-Interview Exclusive',
      description: 'Focused MCQ drills on data interpretation, tabular representation, puzzles, alphanumeric reasoning, and logical sequences.',
      chapters: 8,
      lessons: 30,
      time: '16 hrs',
    },
    {
      id: 'g2a-noninterview-2',
      name: 'Group 2A: Ministerial & Subordinate Service Foundation',
      category: 'group2_2a',
      subCategory: 'group2a',
      scopeTag: 'Group 2A Non-Interview Exclusive',
      description: 'Official communication, Tamil Nadu Government administrative hierarchy, RTI Act 2005, and Citizen Charter fundamentals.',
      chapters: 7,
      lessons: 24,
      time: '15 hrs',
    },

    // --- TNPSC Group 4 & VAO (Combined & Separable) ---
    {
      id: 'g4-both-1',
      name: 'General Tamil (பொதுத் தமிழ் - 100 வினாக்கள் / 150 மதிப்பெண்கள்)',
      category: 'group4_vao',
      subCategory: 'both',
      scopeTag: 'Group 4 & VAO Common (SSLC Std)',
      description: 'Full 100 questions Tamil syllabus covering 6th to 12th Samacheer Kalvi Tamil texts, Thirukkural, and Grammar rules.',
      chapters: 18,
      lessons: 60,
      time: '32 hrs',
    },
    {
      id: 'g4-both-2',
      name: 'General Studies Foundation (75 Questions / 112.5 Marks)',
      category: 'group4_vao',
      subCategory: 'both',
      scopeTag: 'Group 4 & VAO Common (SSLC Std)',
      description: 'General Science, Current Affairs, Geography, History of India & Tamil Nadu, Indian Polity, and Economy (SSLC standard).',
      chapters: 15,
      lessons: 52,
      time: '28 hrs',
    },
    {
      id: 'g4-both-3',
      name: 'Aptitude & Mental Ability (25 Questions / 37.5 Marks)',
      category: 'group4_vao',
      subCategory: 'both',
      scopeTag: 'Group 4 & VAO Common',
      description: 'Arithmetic problems, numbers, sequence and series, percentage, time and work, time and distance for Group 4 & VAO.',
      chapters: 8,
      lessons: 30,
      time: '16 hrs',
    },
    {
      id: 'vao-special-1',
      name: 'Village Administration & Revenue Functions (VAO Special)',
      category: 'group4_vao',
      subCategory: 'vao',
      scopeTag: 'VAO Exclusive Module',
      description: 'Role of Village Administrative Officer, Jamabandi, Land Revenue recovery, Patta transfer regulations, and District Revenue setup.',
      chapters: 9,
      lessons: 28,
      time: '18 hrs',
    },
    {
      id: 'vao-special-2',
      name: 'Land Records, Chitta & Adangal Maintenance (VAO Special)',
      category: 'group4_vao',
      subCategory: 'vao',
      scopeTag: 'VAO Exclusive Module',
      description: 'Complete guide on Record of Rights, Chitta, Adangal (Village Account No. 2), FMB sketch reading, and e-Adangal verification.',
      chapters: 7,
      lessons: 22,
      time: '14 hrs',
    },
    {
      id: 'vao-special-3',
      name: 'Birth/Death Registration, Disaster Relief & Law & Order Reports',
      category: 'group4_vao',
      subCategory: 'vao',
      scopeTag: 'VAO Exclusive Module',
      description: 'Statutory duties of VAO regarding vital statistics, reporting crimes/unnatural deaths, and flood/drought relief assessments.',
      chapters: 6,
      lessons: 18,
      time: '12 hrs',
    },
    {
      id: 'g4-special-1',
      name: 'Office Procedures, Government Orders (G.O.) & Note Writing',
      category: 'group4_vao',
      subCategory: 'group4',
      scopeTag: 'Group 4 Junior Assistant Exclusive',
      description: 'Tamil Nadu Secretariat manual fundamentals, file indexing, disposal systems, inward/outward registers, and official letters.',
      chapters: 6,
      lessons: 20,
      time: '13 hrs',
    },
    {
      id: 'g4-special-2',
      name: 'Typist & Steno-Typist Tamil/English Speed Keyboarding Guide',
      category: 'group4_vao',
      subCategory: 'group4',
      scopeTag: 'Group 4 Typist/Steno Exclusive',
      description: 'Guidance and practice resources for Tamil & English Typewriting/Shorthand candidates appearing for Group 4 postings.',
      chapters: 5,
      lessons: 16,
      time: '10 hrs',
    },
  ]

  const handleGroupChange = (group: 'group1' | 'group2_2a' | 'group4_vao') => {
    setSelectedGroup(group)
    setSubFilter('all')
  }

  const filteredSubjectsOther = subjectsOther.filter((subject) => {
    if (subject.category !== selectedGroup) return false
    if (subFilter === 'all') return true
    if (subject.subCategory === 'both') return true
    return subject.subCategory === subFilter
  })

  const currentSubFilters = subFiltersMap[selectedGroup]

  // Group 1 Dynamic Metrics from Authoritative Data
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
            <span>
              Study <span className="gradient-text">Materials</span>
            </span>
          </h1>
          <p className="materials-subtitle">
            Organized syllabus notes and lesson-wise modules across TNPSC Group 1, Group 2 & 2A, and Group 4 & VAO
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

        {/* STEP 1: When user clicks TNPSC Group 1, display two separate cards: General Studies & Aptitude */}
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
        ) : (
          /* For Group 2 & 2A and Group 4 & VAO */
          <>
            {/* Sub-Filters for Combined Categories */}
            {currentSubFilters.length > 0 && (
              <motion.div
                className="sub-filters-container"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <span className="sub-filter-label">
                  <Filter size={15} />
                  Filter by Stream:
                </span>
                <div className="sub-filters">
                  {currentSubFilters.map((sub) => (
                    <button
                      key={sub.id}
                      className={`sub-filter-btn ${subFilter === sub.id ? 'active' : ''}`}
                      onClick={() => setSubFilter(sub.id)}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Subjects Grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedGroup}-${subFilter}`}
                className="subjects-grid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                {filteredSubjectsOther.map((subject, index) => (
                  <motion.div
                    key={subject.id}
                    className="subject-card glass"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                  >
                    <div className="subject-top-bar">
                      <span className="subject-scope-tag">{subject.scopeTag}</span>
                    </div>

                    <div className="subject-header">
                      <div className="subject-icon">
                        <FileText size={28} />
                      </div>
                      <h3 className="subject-name">{subject.name}</h3>
                    </div>

                    <p className="subject-description">{subject.description}</p>

                    <div className="subject-stats">
                      <div className="subject-stat">
                        <span className="stat-number">{subject.chapters}</span>
                        <span className="stat-label">Chapters</span>
                      </div>
                      <div className="subject-stat">
                        <span className="stat-number">{subject.lessons}</span>
                        <span className="stat-label">Lessons</span>
                      </div>
                      <div className="subject-stat">
                        <Clock size={16} />
                        <span className="stat-label">{subject.time}</span>
                      </div>
                    </div>

                    <button
                      className="subject-btn"
                      onClick={() => navigate('/school-materials')}
                    >
                      <span>View Lessons & Notes</span>
                      <ChevronRight size={18} />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  )
}

export default StudyMaterials
