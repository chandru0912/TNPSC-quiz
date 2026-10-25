// TNPSC Group 2 & 2A: Samacheer Kalvi School Textbook (6th to 12th Standard) Syllabus Mapping
// Mapped specifically to the official Group 2 & 2A Preliminary Examination Syllabus (Code: 495)

export interface Group2SchoolLesson {
  id: string
  lessonNumber: string
  title: string
  term?: string
  description?: string
  status: 'Available' | 'Coming Soon'
  practiceMCQs?: Array<{
    id: string
    question: string
    options: string[]
    correctAnswer: number
    explanation: string
  }>
}

export interface Group2UnitClassData {
  subjectId: string
  unitId: number
  classId: number
  subjectTitle: string
  unitTitle: string
  unitNumber: string
  classTitle: string
  standardNumber: number
  subjectName: string
  topics: string[]
  lessons: Group2SchoolLesson[]
}

export const standardClasses = [
  { id: 6, label: '6th Standard', shortLabel: '6th Std' },
  { id: 7, label: '7th Standard', shortLabel: '7th Std' },
  { id: 8, label: '8th Standard', shortLabel: '8th Std' },
  { id: 9, label: '9th Standard', shortLabel: '9th Std' },
  { id: 10, label: '10th Standard', shortLabel: '10th Std' },
  { id: 11, label: '11th Standard', shortLabel: '11th Std' },
  { id: 12, label: '12th Standard', shortLabel: '12th Std' },
]

export const group2ClassRegistry: Record<string, Group2UnitClassData> = {
  // General Studies - Unit 1: General Science
  'general-studies-1-6': {
    subjectId: 'general-studies',
    unitId: 1,
    classId: 6,
    subjectTitle: 'General Studies',
    unitTitle: 'General Science',
    unitNumber: 'Unit I',
    classTitle: '6th Standard',
    standardNumber: 6,
    subjectName: 'Science (Samacheer Kalvi)',
    topics: [
      'Measurements, SI Units, and Dimensions',
      'Forces, Types of Motion, and Everyday Mechanics',
      'Matter Around Us: Physical States, Elements & Separation',
      'Living World of Plants and Animals: Cell structures',
      'Health and Hygiene: Nutrients, Deficiency Diseases',
    ],
    lessons: [
      {
        id: 'gs-1-6-l1',
        lessonNumber: '1.1',
        term: 'Term 1',
        title: 'Measurements and Fundamental Physical Units',
        description: 'SI base units, measurement devices, mass vs weight, and volume determinations.',
        status: 'Available',
        practiceMCQs: [
          {
            id: 'mcq-gs-6-1',
            question: 'What is the SI unit of thermodynamic temperature?',
            options: ['Celsius', 'Kelvin', 'Fahrenheit', 'Joule'],
            correctAnswer: 1,
            explanation: 'Kelvin (K) is the SI base unit of temperature in the International System of Units.',
          },
        ],
      },
      {
        id: 'gs-1-6-l2',
        lessonNumber: '1.2',
        term: 'Term 1',
        title: 'Forces, Motion and Speed Calculations',
        description: 'Contact and field forces, uniform and non-uniform motion, speed formula.',
        status: 'Available',
      },
      {
        id: 'gs-1-6-l3',
        lessonNumber: '1.3',
        term: 'Term 1',
        title: 'Health, Nutrients and Deficiency Syndromes',
        description: 'Proteins, carbohydrates, vitamins and preventive nutrition according to SCERT texts.',
        status: 'Available',
      },
    ],
  },
  'general-studies-1-10': {
    subjectId: 'general-studies',
    unitId: 1,
    classId: 10,
    subjectTitle: 'General Studies',
    unitTitle: 'General Science',
    unitNumber: 'Unit I',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Science (SSLC Text)',
    topics: [
      'Laws of Motion & Gravitation (Newtonian Mechanics)',
      'Optics: Refraction, Lenses, Human Eye & Optical Instruments',
      'Thermal Physics: Gas Laws & Thermodynamic Relations',
      'Electricity & Magnetism: Joule’s Heating, Fleming’s Rules',
      'Acoustics: Speed of Sound, Echo & Ultrasonography',
      'Nuclear Physics: Radioactivity, Nuclear Fission & Fusion',
    ],
    lessons: [
      {
        id: 'gs-1-10-l1',
        lessonNumber: '1.1',
        title: 'Laws of Motion and Universal Gravitation',
        description: 'Newton\'s three laws of motion, momentum, impulse, and law of conservation of momentum.',
        status: 'Available',
        practiceMCQs: [
          {
            id: 'mcq-gs-10-1',
            question: 'The recoil of a gun after firing a bullet illustrates which fundamental physical law?',
            options: ['Newton\'s First Law', 'Law of Conservation of Linear Momentum', 'Boyle\'s Law', 'Coulomb\'s Law'],
            correctAnswer: 1,
            explanation: 'Gun recoil is a direct application of Newton\'s Third Law and the Law of Conservation of Linear Momentum.',
          },
        ],
      },
      {
        id: 'gs-1-10-l2',
        lessonNumber: '1.2',
        title: 'Optics, Refraction and Lens Formula',
        description: 'Convex and concave lenses, refractive index, power of lenses, and human vision defects.',
        status: 'Available',
      },
      {
        id: 'gs-1-10-l3',
        lessonNumber: '1.3',
        title: 'Nuclear Physics, Isotopes and Radiation Safety',
        description: 'Radioactivity, alpha, beta, gamma decay, nuclear reactors and radioisotopes in medicine.',
        status: 'Available',
      },
    ],
  },
  // Aptitude - Unit 1: Aptitude
  'aptitude-1-10': {
    subjectId: 'aptitude',
    unitId: 1,
    classId: 10,
    subjectTitle: 'Aptitude and Mental Ability',
    unitTitle: 'Aptitude',
    unitNumber: 'Unit I',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Mathematics (SSLC Text)',
    topics: [
      'Numbers and Sequences: Euclid’s Division Lemma, AP and GP',
      'Algebra: GCD, LCM of Polynomials, Quadratic Equations',
      'Mensuration: Surface Areas & Volumes of Solids (Cylinder, Cone, Sphere)',
      'Statistics and Probability: Mean, Variance, Standard Deviation',
    ],
    lessons: [
      {
        id: 'apt-1-10-l1',
        lessonNumber: '1.1',
        title: 'Highest Common Factor and Lowest Common Multiple',
        description: 'Euclidean algorithm, prime factorization, and polynomial HCF/LCM applications.',
        status: 'Available',
        practiceMCQs: [
          {
            id: 'mcq-apt-10-1',
            question: 'Find the HCF of 84 and 105 using prime factors:',
            options: ['7', '14', '21', '28'],
            correctAnswer: 2,
            explanation: '84 = 2^2 * 3 * 7; 105 = 3 * 5 * 7. Common prime factors are 3 and 7 => HCF = 3 * 7 = 21.',
          },
        ],
      },
      {
        id: 'apt-1-10-l2',
        lessonNumber: '1.2',
        title: 'Mensuration: Surface Areas and Combined Volumes',
        description: 'Curved surface area, total surface area, and volume formulas for 10th standard.',
        status: 'Available',
      },
    ],
  },
  // General English - Unit 1: Grammar
  'general-english-1-10': {
    subjectId: 'general-english',
    unitId: 1,
    classId: 10,
    subjectTitle: 'General English',
    unitTitle: 'Grammar',
    unitNumber: 'Unit I',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'English (SSLC Text)',
    topics: [
      'Concord and Subject-Verb Agreement',
      'Active and Passive Voice transformations',
      'Tense Forms: Present, Past, Future, Continuous & Perfect',
      'Direct and Indirect Speech rules',
      'Sentence Patterns: SVO, SVC, SVIODO, SVOC',
    ],
    lessons: [
      {
        id: 'ge-1-10-l1',
        lessonNumber: '1.1',
        title: 'Subject-Verb Agreement and Voice Transformations',
        description: 'Mastery of concord rules with singular/plural subjects and passive voice conversions.',
        status: 'Available',
        practiceMCQs: [
          {
            id: 'mcq-ge-10-1',
            question: 'Neither of the boys ______ present yesterday.',
            options: ['was', 'were', 'are', 'have been'],
            correctAnswer: 0,
            explanation: '"Neither of" takes a singular verb, and "yesterday" dictates past tense => "was".',
          },
        ],
      },
    ],
  },
  // General Tamil - Unit 1: இலக்கணம்
  'general-tamil-1-10': {
    subjectId: 'general-tamil',
    unitId: 1,
    classId: 10,
    subjectTitle: 'General Tamil',
    unitTitle: 'இலக்கணம்',
    unitNumber: 'அலகு I',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'தமிழ் (பத்தாம் வகுப்புப் பாடநூல்)',
    topics: [
      'எழுத்து மற்றும் சொல் வகைப்பாடுகள்',
      'தொகைநிலைத் தொடர்கள் (வேற்றுமை, வினை, பண்பு, உவமை, உம்மைத்தொகை)',
      'தொகாநிலைத் தொடர்கள் (எழுவாய், விளி, வினையெச்சத் தொடர்)',
      'யாப்பிலக்கணம்: எழுத்து, அசை, சீர், தளை, அடி, தொடை',
    ],
    lessons: [
      {
        id: 'gt-1-10-l1',
        lessonNumber: '1.1',
        title: 'தொகைநிலை மற்றும் தொகாநிலைத் தொடர்கள்',
        description: 'பத்தாம் வகுப்புப் பாடநூல் இயல் 2 & 3 தொகைநிலை, தொகாநிலைத் தொடர் விதிகள்.',
        status: 'Available',
        practiceMCQs: [
          {
            id: 'mcq-gt-10-1',
            question: '"கரும்பு தின்றான்" - என்பது எவ்வகைத் தொகைநிலைத் தொடர்?',
            options: ['இரண்டாம் வேற்றுமைத்தொகை', 'வினைத்தொகை', 'பண்புத்தொகை', 'உவமைத்தொகை'],
            correctAnswer: 0,
            explanation: '"கரும்பை தின்றான்" என இரண்டாம் வேற்றுமை உருபான "ஐ" மறைந்து வந்துள்ளதால் இரண்டாம் வேற்றுமைத்தொகை ஆகும்.',
          },
        ],
      },
    ],
  },
}

export const getGroup2UnitClassData = (
  subjectId: string,
  unitId: number,
  classId: number
): Group2UnitClassData => {
  const key = `${subjectId}-${unitId}-${classId}`
  if (group2ClassRegistry[key]) {
    return group2ClassRegistry[key]
  }

  // Generative fallback for all other valid combinations
  const classObj = standardClasses.find((c) => c.id === classId) || standardClasses[0]
  return {
    subjectId,
    unitId,
    classId,
    subjectTitle:
      subjectId === 'general-studies'
        ? 'General Studies'
        : subjectId === 'aptitude'
        ? 'Aptitude and Mental Ability'
        : subjectId === 'general-english'
        ? 'General English'
        : 'General Tamil',
    unitTitle: `Unit ${unitId}`,
    unitNumber: `Unit ${unitId}`,
    classTitle: classObj.label,
    standardNumber: classId,
    subjectName: 'Samacheer Kalvi Textbook Mapping',
    topics: [
      `${classObj.label} Curriculum Scope for Unit ${unitId}`,
      'Prescribed Chapter Readings from SCERT Tamil Nadu Textbooks',
      'School Textbook Terms & Revision Exercises',
      'Previous Year Questions Linked to this Standard',
    ],
    lessons: [
      {
        id: `${subjectId}-${unitId}-${classId}-l1`,
        lessonNumber: '1.1',
        term: 'Term 1',
        title: `${classObj.label} Core Topic Mastery for Unit ${unitId}`,
        description: `Official school textbook alignment for ${classObj.label} addressing Group 2 & 2A syllabus requirements.`,
        status: 'Available',
        practiceMCQs: [
          {
            id: `mcq-${subjectId}-${unitId}-${classId}-1`,
            question: `Which fundamental principle is highlighted in the ${classObj.label} SCERT curriculum for this unit?`,
            options: ['Conceptual Understanding', 'Direct Memorization', 'Historical Approximation', 'Experimental Deviation'],
            correctAnswer: 0,
            explanation: 'TNPSC questions emphasize conceptual understanding from Tamil Nadu SCERT school textbooks.',
          },
        ],
      },
    ],
  }
}
