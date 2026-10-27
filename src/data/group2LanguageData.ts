// TNPSC Group 2 & 2A Language and Aptitude Mappings: Samacheer Kalvi (Classes 6 to 10)
// Covers:
// Part B: Aptitude & Mental Ability (Units 1 & 2)
// Part C: General English / General Tamil (SSLC Standard)

import type { Group2UnitClassData } from './group2ClassSyllabusData'

export const group2LanguageRegistry: Record<string, Group2UnitClassData> = {
  // =========================================================================
  // PART B: APTITUDE & MENTAL ABILITY (SSLC STANDARD)
  // =========================================================================

  // 6th Standard - Aptitude
  'aptitude-1-6': {
    subjectId: 'aptitude',
    unitId: 1,
    classId: 6,
    subjectTitle: 'Aptitude and Mental Ability',
    unitTitle: 'Aptitude',
    unitNumber: 'Unit 1',
    classTitle: '6th Standard',
    standardNumber: 6,
    subjectName: 'Mathematics (Samacheer Kalvi)',
    topics: [
      'Numbers: Place value, Whole numbers, Estimation, Simplification',
      'Ratio and Proportion: Equivalent ratios, Comparison, Unitary method',
      'Numbers: Prime and Composite numbers, Tests of divisibility, HCF and LCM',
      'Fractions, Integers, Perimeter and Area of Square and Rectangle',
    ],
    lessons: [
      {
        id: 'apt-1-6-l1',
        lessonNumber: '1.1',
        term: 'Term 1',
        title: 'Numbers and Fundamental Operations',
        description: 'Large numbers, estimation, brackets and BODMAS order of operations for rapid simplification.',
        status: 'Available',
        keyConcepts: ['BODMAS Rule', 'Estimation & Rounding off', 'Whole Number Properties', 'Prime Factorization'],
        studyNotes: [
          'BODMAS dictates calculation priority: Brackets, Orders, Division, Multiplication, Addition, Subtraction.',
          'Two numbers are co-prime if their Highest Common Factor (HCF) is 1.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-6-1',
            question: 'Evaluate the expression: 20 + [8 × 2 + {16 ÷ 2 - (10 ÷ 5)}]:',
            options: ['38', '42', '46', '50'],
            correctAnswer: 1,
            explanation: '10 ÷ 5 = 2; 16 ÷ 2 - 2 = 8 - 2 = 6; 8 × 2 + 6 = 16 + 6 = 22; 20 + 22 = 42.',
          },
        ],
      },
      {
        id: 'apt-1-6-l2',
        lessonNumber: '1.2',
        term: 'Term 1',
        title: 'Ratio and Proportion',
        description: 'Simplifying ratios, proportion rule (Product of Extremes = Product of Means), and unitary method.',
        status: 'Available',
        keyConcepts: ['Ratio in Simplest Form', 'Extremes and Means', 'Unitary Method', 'Cross-Multiplication'],
        studyNotes: [
          'In a proportion a:b :: c:d, the fundamental property is: a × d = b × c (Product of extremes = Product of means).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-6-2',
            question: 'If 7 : x = 28 : 48, find the value of x:',
            options: ['10', '12', '14', '16'],
            correctAnswer: 1,
            explanation: '7 × 48 = 28 × x => x = (7 × 48) / 28 = 48 / 4 = 12.',
          },
        ],
      },
      {
        id: 'apt-1-6-l3',
        lessonNumber: '1.3',
        term: 'Term 2',
        title: 'Highest Common Factor and Lowest Common Multiple',
        description: 'Finding HCF and LCM by prime factorization and division method; relation: HCF × LCM = Product of two numbers.',
        status: 'Available',
        keyConcepts: ['HCF & LCM Methods', 'Relation: HCF × LCM = a × b', 'Divisibility Rules (2, 3, 5, 9, 11)', 'Word Problems'],
        studyNotes: [
          'For any two positive integers a and b: HCF(a, b) × LCM(a, b) = a × b.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-6-3',
            question: 'The HCF of two numbers is 12 and their LCM is 72. If one number is 24, find the other number:',
            options: ['32', '36', '40', '48'],
            correctAnswer: 1,
            explanation: 'Other number = (HCF × LCM) / First number = (12 × 72) / 24 = 72 / 2 = 36.',
          },
        ],
      },
    ],
  },

  // 7th Standard - Aptitude
  'aptitude-1-7': {
    subjectId: 'aptitude',
    unitId: 1,
    classId: 7,
    subjectTitle: 'Aptitude and Mental Ability',
    unitTitle: 'Aptitude',
    unitNumber: 'Unit 1',
    classTitle: '7th Standard',
    standardNumber: 7,
    subjectName: 'Mathematics (Samacheer Kalvi)',
    topics: [
      'Number System: Operations on Integers, Fractions, Decimals',
      'Measurements: Area and Perimeter of Parallelogram, Rhombus, Trapezium',
      'Measurements: Circumference and Area of Circle (π = 22/7)',
      'Percentage and Simple Interest: Profit, Loss, Simple Interest (I = PNR/100)',
    ],
    lessons: [
      {
        id: 'apt-1-7-l1',
        lessonNumber: '1.1',
        term: 'Term 3',
        title: 'Percentage and Simple Interest',
        description: 'Percentage calculations, profit and loss percentages, and simple interest formula I = (P × N × R) / 100.',
        status: 'Available',
        keyConcepts: ['Conversion of fractions to %', 'Profit% and Loss%', 'Simple Interest: I = PNR/100', 'Total Amount A = P + I'],
        studyNotes: [
          'Simple Interest formula: I = (P × N × R) / 100, where P = Principal, N = Number of years, R = Rate of interest per annum.',
          'Total Amount payable A = Principal + Simple Interest = P(1 + NR/100).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-7-1',
            question: 'Find the simple interest on ₹5,000 invested at 8% per annum for 3 years:',
            options: ['₹1,000', '₹1,200', '₹1,400', '₹1,500'],
            correctAnswer: 1,
            explanation: 'I = (P × N × R) / 100 = (5000 × 3 × 8) / 100 = 50 × 24 = ₹1,200.',
          },
        ],
      },
      {
        id: 'apt-1-7-l2',
        lessonNumber: '1.2',
        term: 'Term 2',
        title: 'Circumference and Area of Circles',
        description: 'Circle radius, diameter, circumference C = 2πr, area A = πr², and circular pathway areas.',
        status: 'Available',
        keyConcepts: ['Circumference C = 2πr', 'Area A = πr²', 'Pathway Area = π(R² - r²)', 'Semicircle Area = (1/2)πr²'],
        studyNotes: [
          'Circumference of a circle with radius r: C = 2πr = πd.',
          'Area of a circular ring of outer radius R and inner radius r is A = π(R² - r²).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-7-2',
            question: 'Find the area of a circle whose radius is 14 cm (use π = 22/7):',
            options: ['308 cm²', '616 cm²', '628 cm²', '712 cm²'],
            correctAnswer: 1,
            explanation: 'Area = πr² = (22/7) × 14 × 14 = 22 × 2 × 14 = 616 cm².',
          },
        ],
      },
    ],
  },

  // 8th Standard - Aptitude
  'aptitude-1-8': {
    subjectId: 'aptitude',
    unitId: 1,
    classId: 8,
    subjectTitle: 'Aptitude and Mental Ability',
    unitTitle: 'Aptitude',
    unitNumber: 'Unit 1',
    classTitle: '8th Standard',
    standardNumber: 8,
    subjectName: 'Mathematics (Samacheer Kalvi)',
    topics: [
      'Numbers: Rational numbers, Square numbers, Square roots, Cube roots',
      'Life Mathematics: Percentage, Profit and loss, Marked price, Discount, GST',
      'Compound Interest: Annual, Half-yearly, Difference between CI and SI',
      'Time and Work: Unitary method, Pipe and Cistern, Chain rule, Inverse variation',
    ],
    lessons: [
      {
        id: 'apt-1-8-l1',
        lessonNumber: '1.1',
        term: 'Term 2',
        title: 'Compound Interest',
        description: 'Compound interest formula A = P(1 + r/100)^n, compounded half-yearly, and difference between CI and SI for 2 years (D = P(r/100)²).',
        status: 'Available',
        keyConcepts: ['Compound Interest Formula', 'Difference: CI - SI for 2 years = P(r/100)²', 'Compounded Half-Yearly', 'Depreciation Formula'],
        studyNotes: [
          'For 2 years, the difference between Compound Interest and Simple Interest is given by: CI - SI = P(r/100)²',
          'Amount compounded half-yearly: A = P(1 + r/200)^(2n).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-8-1',
            question: 'Find the difference between compound interest and simple interest on ₹8,000 at 5% per annum for 2 years:',
            options: ['₹15', '₹20', '₹25', '₹30'],
            correctAnswer: 1,
            explanation: 'Difference = P × (r/100)² = 8000 × (5/100)² = 8000 × (25/10000) = 8000 × 0.0025 = ₹20.',
          },
        ],
      },
      {
        id: 'apt-1-8-l2',
        lessonNumber: '1.2',
        term: 'Term 3',
        title: 'Time and Work',
        description: 'Work done per unit time, combined work efficiency (1/A + 1/B), Pipes and Cisterns, and direct and inverse proportion.',
        status: 'Available',
        keyConcepts: ['Work = Efficiency × Time', 'Combined Work: 1/Total = 1/A + 1/B', 'Pipes & Cisterns Inflow/Outflow', 'Chain Rule: (M1 × D1 × H1)/W1 = (M2 × D2 × H2)/W2'],
        studyNotes: [
          'If A can do a piece of work in \'x\' days and B in \'y\' days, together they complete it in: (x × y) / (x + y) days.',
          'Chain rule: M1 × D1 × H1 × W2 = M2 × D2 × H2 × W1.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-8-2',
            question: 'A can finish a task in 10 days and B can finish it in 15 days. How many days will they take working together?',
            options: ['5 days', '6 days', '7 days', '8 days'],
            correctAnswer: 1,
            explanation: 'Together they complete in (10 × 15) / (10 + 15) = 150 / 25 = 6 days.',
          },
        ],
      },
    ],
  },

  // 9th Standard - Aptitude
  'aptitude-1-9': {
    subjectId: 'aptitude',
    unitId: 1,
    classId: 9,
    subjectTitle: 'Aptitude and Mental Ability',
    unitTitle: 'Aptitude',
    unitNumber: 'Unit 1',
    classTitle: '9th Standard',
    standardNumber: 9,
    subjectName: 'Mathematics (Samacheer Kalvi)',
    topics: [
      'Real Numbers: Rational and Irrational numbers, Surds, Scientific notation',
      'Algebra: Polynomial factorization, Linear equations in two variables',
      'Mensuration: Surface area and Volume of Cuboid and Cube',
      'Statistics: Mean, Median, Mode of ungrouped and grouped data',
      'Probability: Empirical probability, Sample space, Random events',
    ],
    lessons: [
      {
        id: 'apt-1-9-l1',
        lessonNumber: '1.1',
        term: 'Term 3',
        title: 'Mensuration: Surface Area and Volume of Cuboids and Cubes',
        description: 'Total surface area (TSA), Lateral surface area (LSA), and volume of cubes (a³) and cuboids (l × b × h).',
        status: 'Available',
        keyConcepts: ['Cuboid TSA = 2(lb + bh + lh)', 'Cuboid Volume = l × b × h', 'Cube TSA = 6a²', 'Cube Volume = a³'],
        studyNotes: [
          'Volume of cuboid = length × breadth × height.',
          'Diagonal of a cuboid = √(l² + b² + h²); diagonal of a cube = a√3.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-9-1',
            question: 'Find the volume of a cuboid whose dimensions are length = 12 cm, breadth = 8 cm, and height = 5 cm:',
            options: ['420 cm³', '480 cm³', '520 cm³', '560 cm³'],
            correctAnswer: 1,
            explanation: 'Volume = l × b × h = 12 × 8 × 5 = 12 × 40 = 480 cm³.',
          },
        ],
      },
    ],
  },

  // 10th Standard - Aptitude (Updated & Complete)
  'aptitude-1-10': {
    subjectId: 'aptitude',
    unitId: 1,
    classId: 10,
    subjectTitle: 'Aptitude and Mental Ability',
    unitTitle: 'Aptitude',
    unitNumber: 'Unit 1',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Mathematics (SSLC Text)',
    topics: [
      'Numbers and Sequences: Euclid’s Division Lemma, Fundamental Theorem of Arithmetic',
      'Arithmetic Progression (AP) and Geometric Progression (GP), Sum of Special Series',
      'Algebra: GCD and LCM of Polynomials, Quadratic Equations',
      'Mensuration: Surface Area and Volume of Cylinder, Cone, Sphere, Hemisphere, Frustum',
      'Statistics and Probability: Standard Deviation, Variance, Coefficient of Variation',
    ],
    lessons: [
      {
        id: 'apt-1-10-l1',
        lessonNumber: '1.1',
        term: 'Volume 1',
        title: 'Highest Common Factor and Lowest Common Multiple',
        description: 'Euclid’s division algorithm, prime factorization, and polynomial HCF/LCM applications.',
        status: 'Available',
        keyConcepts: ['Euclid\'s Division Lemma: a = bq + r', 'Fundamental Theorem of Arithmetic', 'HCF and LCM of Polynomials', 'Product of Numbers = HCF × LCM'],
        studyNotes: [
          'Euclid’s Division Lemma states that for any two positive integers a and b, there exist unique integers q and r such that a = bq + r, 0 ≤ r < b.',
          'HCF of two polynomials is their common divisor of highest degree with highest coefficients.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-10-1',
            question: 'Find the HCF of 84 and 105 using prime factors:',
            options: ['7', '14', '21', '28'],
            correctAnswer: 2,
            explanation: '84 = 2² × 3 × 7; 105 = 3 × 5 × 7. Common factors = 3 × 7 = 21.',
          },
        ],
      },
      {
        id: 'apt-1-10-l2',
        lessonNumber: '1.2',
        term: 'Volume 2',
        title: 'Mensuration: Surface Areas and Combined Volumes of Solids',
        description: 'Formulas and problems on Right Circular Cylinder, Cone, Sphere, Hemisphere, Frustum, and conversion of solids.',
        status: 'Available',
        keyConcepts: ['Cylinder Volume = πr²h, CSA = 2πrh', 'Cone Volume = (1/3)πr²h, Slant height l = √(r² + h²)', 'Sphere Volume = (4/3)πr³, TSA = 4πr²', 'Hemisphere Volume = (2/3)πr³, TSA = 3πr²'],
        studyNotes: [
          'Volume of right circular cone is exactly one-third the volume of a cylinder having the same radius and height: V = (1/3)πr²h.',
          'When one solid is melted and recast into another solid shape, the total volume remains constant.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-10-2',
            question: 'If a solid sphere of radius 6 cm is melted and recast into small spheres of radius 2 cm each, how many small spheres will be formed?',
            options: ['9', '18', '27', '36'],
            correctAnswer: 2,
            explanation: 'Number of spheres = (Volume of big sphere) / (Volume of small sphere) = (4/3 π × 6³) / (4/3 π × 2³) = (6/2)³ = 3³ = 27.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  // PART B: UNIT 2 - REASONING
  // =========================================================================

  'aptitude-2-10': {
    subjectId: 'aptitude',
    unitId: 2,
    classId: 10,
    subjectTitle: 'Aptitude and Mental Ability',
    unitTitle: 'Reasoning',
    unitNumber: 'Unit 2',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'Reasoning and Mental Ability (SSLC Standard)',
    topics: [
      'Logical Reasoning: Deductive logic, Syllogisms, Statement and Assumptions',
      'Puzzles and Direction Sense: Blood relations, Seating arrangements, Clock problems',
      'Dice and Cube Problems: Opposite faces, Unfolded cube patterns',
      'Visual Reasoning: Mirror images, Water images, Paper folding, Embedded figures',
      'Alpha-Numeric Reasoning & Number Series: Missing numbers, Coding-Decoding',
    ],
    lessons: [
      {
        id: 'apt-2-10-l1',
        lessonNumber: '2.1',
        term: 'Volume 1',
        title: 'Number Series, Sequences and Alpha-Numeric Reasoning',
        description: 'Pattern identification in arithmetic, geometric, alternating, square/cube number series and alphanumeric substitution codes.',
        status: 'Available',
        keyConcepts: ['Arithmetic & Geometric Series', 'Alternating Differences', 'Alphanumeric Coding-Decoding', 'Position Values of Letters (A=1, Z=26)'],
        studyNotes: [
          'Letter positioning: memorize "EJOTY" multiples of 5 (E=5, J=10, O=15, T=20, Y=25) for rapid decoding.',
          'Check prime number series, difference of differences, and (n² ± 1) or (n³ ± 1) patterns.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-reasoning-1',
            question: 'Find the next term in the number series: 2, 6, 12, 20, 30, ?',
            options: ['38', '40', '42', '44'],
            correctAnswer: 2,
            explanation: 'The differences are +4, +6, +8, +10, so next difference is +12 => 30 + 12 = 42 (also n² + n: 1²+1=2, 2²+2=6, ..., 6²+6=42).',
          },
        ],
      },
      {
        id: 'apt-2-10-l2',
        lessonNumber: '2.2',
        term: 'Volume 2',
        title: 'Puzzles, Dice and Visual Reasoning',
        description: 'Standard and ordinary dice rules, opposite face determination, unfolded net logic, mirror images, and spatial visualization.',
        status: 'Available',
        keyConcepts: ['Standard Dice Rule (Opposite faces sum to 7)', 'Single & Two Common Face Dice Rules', 'Mirror & Water Inversion Rules', 'Direction Sense Geometry'],
        studyNotes: [
          'In a standard die, the sum of opposite faces is always 7 (1 opposite 6, 2 opposite 5, 3 opposite 4).',
          'When two positions of a die have two common faces, the remaining uncommon faces on both positions are opposite each other.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-apt-reasoning-2',
            question: 'In a standard die, which number is always directly opposite to the face numbered 3?',
            options: ['2', '4', '5', '6'],
            correctAnswer: 1,
            explanation: 'In a standard die, opposite faces sum to 7. Therefore, opposite face to 3 is 7 - 3 = 4.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  // PART C: GENERAL ENGLISH (SSLC STANDARD)
  // =========================================================================

  'general-english-1-10': {
    subjectId: 'general-english',
    unitId: 1,
    classId: 10,
    subjectTitle: 'General English',
    unitTitle: 'Grammar and Literary Works',
    unitNumber: 'Unit 1',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'English (Samacheer Kalvi SSLC)',
    topics: [
      'Grammar: Parts of speech, Concord, Tenses, Active and Passive voice, Direct and Indirect speech',
      'Sentence Types: Simple, Compound, Complex, Question tags, Degrees of comparison',
      'Vocabulary: Synonyms, Antonyms, Homophones, Phrasal verbs, Idioms, Figures of speech',
      'Literary Works: Prescribed Poems and Prose by Liam O’Flaherty, Henry Van Dyke, Rudyard Kipling, Satyajit Ray',
    ],
    lessons: [
      {
        id: 'ge-1-10-l1',
        lessonNumber: '1.1',
        term: 'Volume 1',
        title: 'Subject-Verb Concord and Voice Transformations',
        description: 'Rules of subject-verb agreement (concord) with compound subjects, collective nouns, and Active-to-Passive voice transformations.',
        status: 'Available',
        keyConcepts: ['Subject-Verb Concord Rules', 'Active to Passive Voice', 'Direct and Indirect Speech Rules', 'Question Tags'],
        studyNotes: [
          'When two subjects are connected by "as well as", "along with", or "together with", the verb agrees with the first subject.',
          'In question tags, positive statements take negative tags, and negative statements take positive tags.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-ge-10-1',
            question: 'Choose the grammatically correct verb: "The Captain, along with his crew members, _____ rescued."',
            options: ['were', 'was', 'are', 'have been'],
            correctAnswer: 1,
            explanation: 'When subjects are joined by "along with", the verb agrees with the first subject ("The Captain", singular => "was").',
          },
        ],
      },
      {
        id: 'ge-1-10-l2',
        lessonNumber: '1.2',
        term: 'Volume 1',
        title: 'Literary Works: Prose & Poetry Analysis',
        description: 'Analysis of syllabus poems (Life by Henry Van Dyke, The Secret of the Machines by Rudyard Kipling) and prose (His First Flight by Liam O’Flaherty).',
        status: 'Available',
        keyConcepts: ['Henry Van Dyke "Life"', 'Liam O’Flaherty "His First Flight"', 'Rudyard Kipling "The Secret of the Machines"', 'Figures of Speech (Metaphor, Simile, Personification)'],
        studyNotes: [
          '"Life" by Henry Van Dyke is a sonnet expressing optimism and courage to live life with a whole and happy heart.',
          '"His First Flight" by Liam O\'Flaherty allegorically depicts overcoming hesitation and fear to attain self-reliance.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-ge-10-2',
            question: 'Who authored the inspiring short story "His First Flight", depicting a young seagull\'s maiden flight?',
            options: ['James Grover Thurber', 'Liam O’Flaherty', 'Satyajit Ray', 'Alphonse Daudet'],
            correctAnswer: 1,
            explanation: 'Liam O\'Flaherty wrote the iconic story "His First Flight", prescribed in the TNPSC SSLC syllabus.',
          },
        ],
      },
    ],
  },

  // =========================================================================
  // PART C: GENERAL TAMIL (SSLC STANDARD)
  // =========================================================================

  'general-tamil-1-10': {
    subjectId: 'general-tamil',
    unitId: 1,
    classId: 10,
    subjectTitle: 'பொதுத் தமிழ்',
    unitTitle: 'இலக்கணம் மற்றும் இலக்கியம்',
    unitNumber: 'அலகு I',
    classTitle: '10th Standard',
    standardNumber: 10,
    subjectName: 'தமிழ் (சமச்சீர் கல்வி பத்தாம் வகுப்பு)',
    topics: [
      'இலக்கணம்: எழுத்து, சொல், தொடர் இலக்கணம், தொகைநிலை மற்றும் தொகாநிலைத் தொடர்கள்',
      'அணி இலக்கணம்: உவமை அணி, உருவக அணி, வேற்றுமை அணி, தற்குறிப்பேற்ற அணி',
      'திருக்குறள்: ஒழுக்கமுடைமை, அறன் வலியுறுத்தல், கூடா ஒழுக்கம், கல்வி, செங்கோன்மை',
      'தமிழ் அறிஞர்களும் தமிழ்த்தொண்டும்: பாரதியார், பாரதிதாசன், பெருஞ்சித்திரனார், தேவநேயப் பாவாணர்',
    ],
    lessons: [
      {
        id: 'gt-1-10-l1',
        lessonNumber: '1.1',
        term: 'Volume 1',
        title: 'எழுத்து மற்றும் சொல் இலக்கணம்',
        description: 'சார்பெழுத்துகள் (10 வகைகள்), அளபெடை (உயிரளபெடை, ஒற்றளபெடை), மூவகை மொழிகள் (தனிமொழி, தொடர்மொழி, பொதுமொழி), மற்றும் தொழிற்பெயர்.',
        status: 'Available',
        keyConcepts: ['உயிரளபெடை (செய்யுளிசை, இன்னிசை, சொல்லிசை)', 'ஒற்றளபெடை (11 எழுத்துகள்)', 'தனிமொழி, தொடர்மொழி, பொதுமொழி', 'தொழிற்பெயர் மற்றும் வினையாலணையும் பெயர்'],
        studyNotes: [
          'செய்யுளில் ஓசை குறையும்போது அதனை நிறைவு செய்ய உயிர்நெடில் எழுத்துகள் ஏழும் அளபெடுப்பது செய்யுளிசை அளபெடை அல்லது இசைநிறை அளபெடை ஆகும்.',
          'ஒரு சொல் தனித்து நின்று ஒரு பொருளையும், அச்சொல்லே பிரிந்து நின்று வேறு பொருளையும் தருவது பொதுமொழி எனப்படும் (எ.கா. எட்டு, வேங்கை).',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gt-10-1',
            question: '"வேங்கை" என்ற சொல் தனித்து நின்று மரத்தையும், "வேம் + கை" எனப் பிரிந்து வெந்த கை எனவும் பொருள் தருவதால் எவ்வகை மொழியாகும்?',
            options: ['தனிமொழி', 'தொடர்மொழி', 'பொதுமொழி', 'விரவுமொழி'],
            correctAnswer: 2,
            explanation: 'ஒரு சொல் தனித்து நின்று ஒரு பொருளையும் பிரிந்து நின்று வேறு பொருளையும் தருவது "பொதுமொழி" ஆகும்.',
          },
        ],
      },
      {
        id: 'gt-1-10-l2',
        lessonNumber: '1.2',
        term: 'Volume 1',
        title: 'திருக்குறள் அறநெறிகள் மற்றும் உரைமரபு',
        description: 'அறத்துப்பால் மற்றும் பொருட்பால் அதிகாரங்கள்: ஒழுக்கமுடைமை, காலமறிதல், கல்லாமை, செங்கோன்மை, மற்றும் வள்ளுவர் கூறும் உலகப் பொதுநீதிகள்.',
        status: 'Available',
        keyConcepts: ['ஒழுக்கம் விழுப்பம் தரலான்', 'காலமறிதல் அதிகாரக் கருத்துகள்', 'செங்கோன்மை vs கொடுங்கோன்மை', 'திருக்குறள் சிறப்புப் பெயர்கள்'],
        studyNotes: [
          '"ஒழுக்கம் விழுப்பம் தரலான் ஒழுக்கம் உயிரினும் ஓம்பப் படும்" - ஒழுக்கமே அனைவருக்கும் சிறப்பைத் தருவதால் அதனை உயிரினும் மேலாகப் போற்ற வேண்டும்.',
          'திருக்குறளுக்கு உரை எழுதிய பதின்மரில் பரிமேலழகர் உரையே தலைசிறந்ததாகப் போற்றப்படுகிறது.',
        ],
        practiceMCQs: [
          {
            id: 'mcq-gt-10-2',
            question: 'திருக்குறளுக்கு உரை எழுதிய பழைய பதின்மரில் யாருடைய உரை மிகச் சிறந்த உரையாகப் போற்றப்படுகிறது?',
            options: ['மணக்குடவர்', 'தருமர்', 'பரிமேலழகர்', 'நச்சர்'],
            correctAnswer: 2,
            explanation: 'திருக்குறளுக்கு எழுதப்பட்ட பழமையான உரைகளுள் பரிமேலழகரின் உரையே மிகச் சிறந்த உரையாக அறிஞர்களால் ஏற்கப்பட்டுள்ளது.',
          },
        ],
      },
    ],
  },
}
