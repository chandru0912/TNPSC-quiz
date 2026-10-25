// TNPSC Group 2 & 2A: Samacheer Kalvi School Textbook (6th to 12th Standard) Syllabus Mapping
// Mapped specifically to the official Group 2 & 2A Preliminary Examination Syllabus (Code: 495)

export interface Group2SchoolLesson {
  id: string
  lessonNumber: string
  title: string
  term?: string
  description?: string
  status: 'Available' | 'Coming Soon'
  keyConcepts?: string[]
  studyNotes?: string[]
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
      'Measurements: SI Units, Length, Mass, Time',
      'Forces and Motion: Types of Motion, Speed',
      'Matter Around Us: Solids, Liquids, Gases, Separation of Substances',
      'The Living World of Plants & Animals: Cell Structure, Habitat',
      'Health and Hygiene: Nutrients, Deficiency Diseases',
      'Electricity: Electric Circuits, Conductors and Insulators',
      'Heat & Magnetism: Temperature, Magnetic Poles, Applications',
    ],
    lessons: [
      {
        id: 'gs-1-6-l1',
        lessonNumber: '1.1',
        term: 'Term 1',
        title: 'Measurements and SI Units',
        description: 'Fundamental units, length, mass, time, volume and everyday measurement devices.',
        status: 'Available',
        keyConcepts: ['SI Base Units', 'Derived Units', 'Parallax Method', 'Precision & Accuracy'],
        studyNotes: [
          'The International System of Units (SI) establishes standard base quantities: meter (m), kilogram (kg), second (s), ampere (A), kelvin (K), mole (mol), and candela (cd).',
          'Mass is the quantity of matter contained in a body, while weight is the gravitational force acting on that matter (W = mg).',
          'Volume of irregular solids is accurately measured using measuring cylinders via liquid displacement method.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-1',
            question: 'What is the SI base unit of thermodynamic temperature?',
            options: ['Degree Celsius (°C)', 'Kelvin (K)', 'Degree Fahrenheit (°F)', 'Joule (J)'],
            correctAnswer: 1,
            explanation: 'Kelvin (K) is the SI base unit of temperature in the International System of Units.',
          },
          {
            id: 'mcq-gs-6-1b',
            question: 'Which instrument is most suitable for measuring the thickness of a 5-rupee coin?',
            options: ['Meter scale', 'Vernier Caliper', 'Screw Gauge', 'Measuring tape'],
            correctAnswer: 2,
            explanation: 'A screw gauge has a least count of 0.01 mm, making it ideal for measuring tiny dimensions like coin thickness.',
          },
        ],
      },
      {
        id: 'gs-1-6-l2',
        lessonNumber: '1.2',
        term: 'Term 1',
        title: 'Forces and Motion',
        description: 'Contact and non-contact forces, types of motion, speed calculations and distance-time relations.',
        status: 'Available',
        keyConcepts: ['Contact Forces', 'Field Forces', 'Periodic Motion', 'Speed = Distance / Time'],
        studyNotes: [
          'Forces are push or pull interactions categorized into contact forces (muscular, friction) and non-contact field forces (gravitational, magnetic, electrostatic).',
          'Motion can be rectilinear, curvilinear, circular, rotatory, oscillatory, or zigzag (random).',
          'Speed is defined as the distance covered per unit time: Speed = Distance / Time (m/s).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-2',
            question: 'The motion of a pendulum in a clock is an example of which type of motion?',
            options: ['Linear motion', 'Oscillatory and periodic motion', 'Random motion', 'Circular non-periodic motion'],
            correctAnswer: 1,
            explanation: 'A pendulum exhibits oscillatory motion that repeats at regular intervals of time, making it periodic.',
          },
        ],
      },
      {
        id: 'gs-1-6-l3',
        lessonNumber: '1.3',
        term: 'Term 1',
        title: 'Matter Around Us',
        description: 'Physical states of matter, separation of mixtures, handpicking, filtration and decantation.',
        status: 'Available',
        keyConcepts: ['Solids, Liquids, Gases', 'Pure Substances vs Mixtures', 'Filtration', 'Centrifugation'],
        studyNotes: [
          'Matter consists of tiny particles that occupy space and have mass. The arrangement and kinetic energy of particles determine solid, liquid, or gaseous state.',
          'Heterogeneous mixtures can be separated using handpicking, sieving, winnowing, sedimentation, decantation, and filtration.',
          'Sublimation is used to separate volatile components from non-volatile solids (e.g., camphor and salt).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-3',
            question: 'Which method is used to separate butter from curd in households?',
            options: ['Filtration', 'Churning (Centrifugation)', 'Distillation', 'Sedimentation'],
            correctAnswer: 1,
            explanation: 'Churning uses centrifugal force where heavier liquid separates from lighter butter particles.',
          },
        ],
      },
      {
        id: 'gs-1-6-l4',
        lessonNumber: '1.4',
        term: 'Term 1',
        title: 'The Living World of Plants',
        description: 'Plant parts, root and shoot systems, photosynthesis basics and plant adaptations.',
        status: 'Available',
        keyConcepts: ['Taproot vs Fibrous Root', 'Chlorophyll', 'Transpiration', 'Stomata'],
        studyNotes: [
          'Flowering plants comprise a root system (taproot in dicots, fibrous in monocots) and a shoot system (stem, leaves, flowers, fruits).',
          'Leaves prepare food via photosynthesis using sunlight, chlorophyll, CO2, and water, releasing oxygen.',
          'Loss of excess water vapor through stomata is known as transpiration, creating suction pull for water absorption.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-4',
            question: 'In plants, water transpiration primarily takes place through:',
            options: ['Lenticels', 'Stomata', 'Root hairs', 'Bark'],
            correctAnswer: 1,
            explanation: 'Stomata present on the underside of leaves facilitate gaseous exchange and transpiration.',
          },
        ],
      },
      {
        id: 'gs-1-6-l5',
        lessonNumber: '1.5',
        term: 'Term 1',
        title: 'Living World of Animals',
        description: 'Unicellular and multicellular organisms, biodiversity, adaptations in camel, fish and birds.',
        status: 'Available',
        keyConcepts: ['Amoeba & Paramecium', 'Fish Gills & Fins', 'Camel Adaptations', 'Pneumatic Bones in Birds'],
        studyNotes: [
          'Unicellular organisms like Amoeba carry out digestion, respiration, and excretion in a single cell using pseudopodia and vacuoles.',
          'Fish possess streamlined bodies and gills for extracting dissolved oxygen from water.',
          'Birds have hollow pneumatic bones and modified forelimbs as wings to reduce body weight for flight.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-5',
            question: 'Which anatomical adaptation allows birds to have lightweight skeletons for flying?',
            options: ['Cartilage skeleton', 'Pneumatic (hollow) bones', 'Double bone density', 'absence of vertebrae'],
            correctAnswer: 1,
            explanation: 'Birds possess pneumatic bones filled with air cavities that drastically reduce weight while maintaining structural strength.',
          },
        ],
      },
      {
        id: 'gs-1-6-l6',
        lessonNumber: '1.6',
        term: 'Term 1',
        title: 'Health and Hygiene',
        description: 'Carbohydrates, proteins, fats, vitamins, minerals, water and nutritional deficiency diseases.',
        status: 'Available',
        keyConcepts: ['Balanced Diet', 'Marasmus & Kwashiorkor', 'Vitamin Deficiencies', 'Personal Hygiene'],
        studyNotes: [
          'Nutrients are categorized into macronutrients (carbohydrates, fats, proteins) and micronutrients (vitamins, minerals).',
          'Protein energy malnutrition results in Kwashiorkor (swollen belly, edema) and Marasmus (severe muscle wasting).',
          'Night blindness is caused by Vitamin A deficiency; Scurvy by Vitamin C deficiency; Rickets by Vitamin D deficiency.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-6',
            question: 'Scurvy is caused due to the dietary deficiency of which vitamin?',
            options: ['Vitamin A', 'Vitamin B1', 'Vitamin C', 'Vitamin D'],
            correctAnswer: 2,
            explanation: 'Vitamin C (Ascorbic acid) deficiency causes bleeding gums and impaired wound healing known as scurvy.',
          },
        ],
      },
      {
        id: 'gs-1-6-l7',
        lessonNumber: '1.7',
        term: 'Term 2',
        title: 'Heat and Temperature',
        description: 'Sources of heat, thermal expansion, clinical and laboratory thermometers.',
        status: 'Available',
        keyConcepts: ['Heat Energy (Joule)', 'Temperature (Kelvin)', 'Mercury Thermometer', 'Thermal Expansion'],
        studyNotes: [
          'Heat is a form of thermal energy transferred from a higher temperature body to a lower temperature body.',
          'Clinical thermometers measure human body temperature with a range of 35°C to 42°C (or 94°F to 108°F), containing a constriction to prevent mercury backflow.',
          'Most substances expand when heated and contract when cooled (anomalous expansion of water between 0°C and 4°C is an exception).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-7',
            question: 'The normal human body temperature on the Celsius scale is approximately:',
            options: ['35.5°C', '37°C', '39.2°C', '98.6°C'],
            correctAnswer: 1,
            explanation: 'Normal human body temperature is approximately 37°C (corresponding to 98.6°F).',
          },
        ],
      },
      {
        id: 'gs-1-6-l8',
        lessonNumber: '1.8',
        term: 'Term 2',
        title: 'Electricity and Circuits',
        description: 'Electric cells, simple switch circuits, conductors, insulators and electrical safety.',
        status: 'Available',
        keyConcepts: ['Primary & Secondary Cells', 'Closed Circuit', 'Good Conductors', 'Insulators'],
        studyNotes: [
          'An electric circuit provides a closed continuous conductive path for electric current from the positive terminal to the negative terminal.',
          'Materials that allow electric charges to flow freely are conductors (copper, aluminum), while those that resist are insulators (rubber, glass).',
          'Primary cells are single-use chemical cells; secondary cells (lead-acid, lithium-ion) can be recharged repeatedly.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-8',
            question: 'Which of the following is a non-metal that conducts electricity?',
            options: ['Diamond', 'Graphite', 'Sulphur', 'Phosphorus'],
            correctAnswer: 1,
            explanation: 'Graphite has free delocalized valence electrons between carbon layers, allowing it to conduct electricity.',
          },
        ],
      },
      {
        id: 'gs-1-6-l9',
        lessonNumber: '1.9',
        term: 'Term 3',
        title: 'Magnetism and Magnetic Materials',
        description: 'Discovery of magnets, magnetic poles, magnetic compass and demagnetization.',
        status: 'Available',
        keyConcepts: ['Natural vs Artificial Magnets', 'Like Poles Repel', 'Magnetic Compass', 'Earth Magnetic Field'],
        studyNotes: [
          'Magnetite is a natural magnetic iron ore discovered in Magnesia.',
          'Every magnet has two poles: North and South. Like poles repel each other, whereas unlike poles attract.',
          'Earth behaves like a huge magnetic dipole with its magnetic south pole located near the geographic north pole.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gs-6-9',
            question: 'A freely suspended magnetic needle always comes to rest pointing in which direction?',
            options: ['East-West', 'North-South', 'North-East', 'South-West'],
            correctAnswer: 1,
            explanation: 'Due to the Earth magnetic field, a freely suspended magnet aligns along the geographic North-South direction.',
          },
        ],
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
