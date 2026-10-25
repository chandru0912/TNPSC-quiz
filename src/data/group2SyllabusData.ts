// Official TNPSC Group 2 & 2A Preliminary Examination Syllabus Data
// Source: 495_Group II and IIA prelims.pdf (Code: 495)
//
// Single Paper Structure:
// Part A: General Studies (Degree Standard - 75 Questions)
// Part B: Aptitude and Mental Ability (SSLC Standard - 25 Questions)
// Part C: Language - General English or General Tamil (SSLC Standard - 100 Questions)
//
// The 4 official Subject Sections in exact order:
// 1. General Studies
// 2. Aptitude
// 3. General English
// 4. General Tamil

export interface Group2MCQ {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

export interface Group2Lesson {
  id: string
  lessonNumber: string
  title: string
  tamilTitle?: string
  duration: string
  keyConcepts: string[]
  studyNotes: string[]
  practiceQuestions: Group2MCQ[]
}

export interface Group2Chapter {
  id: string
  chapterNumber: number
  title: string
  tamilTitle?: string
  lessons: Group2Lesson[]
}

export interface Group2Unit {
  id: number
  unitNumber: string
  title: string
  tamilTitle?: string
  questionCount: number
  standard: string
  officialTopics: string[]
  chapters: Group2Chapter[]
}

export interface Group2Subject {
  id: 'general-studies' | 'aptitude' | 'general-english' | 'general-tamil'
  order: number
  title: string
  tamilTitle?: string
  partTag: string
  standard: string
  questionCount: number
  description: string
  accentColor: string
  units: Group2Unit[]
}

// -------------------------------------------------------------
// SUBJECT 1: General Studies (Degree Standard - 75 Questions)
// -------------------------------------------------------------
const generalStudiesSubject: Group2Subject = {
  id: 'general-studies',
  order: 1,
  title: 'General Studies',
  tamilTitle: 'பொது அறிவு',
  partTag: 'Part A • Degree Standard',
  standard: 'Degree Standard',
  questionCount: 75,
  description:
    'Covers General Science, Geography of India, History, Culture of India & National Movement, Indian Polity, Indian Economy & TN Development, and Tamil Society Heritage.',
  accentColor: '#38bdf8',
  units: [
    {
      id: 1,
      unitNumber: 'Unit I',
      title: 'General Science',
      tamilTitle: 'அலகு I: பொது அறிவியல்',
      questionCount: 5,
      standard: 'Degree Standard',
      officialTopics: [
        'Scientific knowledge and scientific temper - Power of reasoning - Rote learning vs conceptual learning',
        'Nature of universe - General scientific laws – Mechanics - Properties of matter, force, motion, and energy',
        'Everyday application of basic principles of mechanics, electricity and magnetism, light, sound, heat, nuclear physics, laser, electronics, communications',
        'Elements and compounds, acids, bases, salts, petroleum products, fertilizers, pesticides',
        'Main concepts of life science, classification of living organisms, evolution, genetics, physiology, nutrition, health and hygiene, human diseases',
        'Environment and ecology; Latest inventions in science and technology; Current affairs',
      ],
      chapters: [
        {
          id: 'gs-u1-c1',
          chapterNumber: 1,
          title: 'Scientific Temper, Laws & Applied Physics',
          tamilTitle: 'அறிவியல் உணர்வு, விதிகள் மற்றும் பயன்பாட்டு இயற்பியல்',
          lessons: [
            {
              id: 'gs-u1-c1-l1',
              lessonNumber: '1.1',
              title: 'Scientific Knowledge, Scientific Temper & Physical Laws',
              duration: '35 mins',
              keyConcepts: ['Scientific Temper (Article 51A(h))', 'Newtonian Mechanics', 'Conservation of Energy', 'EM Waves'],
              studyNotes: [
                'Article 51A(h) of the Constitution mandates every citizen of India to develop a scientific temper, humanism, and the spirit of inquiry and reform.',
                'Newton\'s laws govern classical mechanics: First law establishes inertia; second law relates force to the rate of change of momentum (F=ma); third law ensures action and reaction are equal and opposite.',
                'Everyday electromagnetic applications utilize wave properties: Light (reflection & refraction in lenses), Sound (Doppler effect & ultrasound imaging), and Nuclear physics (radioisotopes in cancer radiotherapy like Cobalt-60).',
              ],
              practiceQuestions: [
                {
                  id: 'gs-q1',
                  question: 'Which article of the Indian Constitution emphasizes the fundamental duty to develop scientific temper and spirit of inquiry?',
                  options: ['Article 21A', 'Article 51A(h)', 'Article 39(b)', 'Article 48A'],
                  correctAnswer: 1,
                  explanation: 'Article 51A(h) declares that it shall be the duty of every citizen of India to develop the scientific temper, humanism and the spirit of inquiry and reform.',
                },
                {
                  id: 'gs-q2',
                  question: 'Which principle explains why an optical fiber can transmit telephone and internet signals without losing signal strength over long distances?',
                  options: ['Refraction of light', 'Total Internal Reflection', 'Diffraction of light', 'Polarization'],
                  correctAnswer: 1,
                  explanation: 'Optical fibers work on the principle of Total Internal Reflection (TIR), where light rays bounce off fiber core walls without loss of energy.',
                },
              ],
            },
          ],
        },
        {
          id: 'gs-u1-c2',
          chapterNumber: 2,
          title: 'Chemical Substances, Life Sciences & Environment',
          tamilTitle: 'வேதியியல் பொருட்கள், உயிரியல் மற்றும் சுற்றுச்சூழல்',
          lessons: [
            {
              id: 'gs-u1-c2-l1',
              lessonNumber: '1.2',
              title: 'Acids, Bases, Genetics, Nutrition & Ecosystem Dynamics',
              duration: '40 mins',
              keyConcepts: ['pH Scale', 'Mendelian Genetics', 'Macronutrients & Micronutrients', 'Trophic Levels & Biodiversity'],
              studyNotes: [
                'Acids have pH < 7, donate H+ ions, and turn blue litmus red. Bases have pH > 7, donate OH- ions, and turn red litmus blue. Salts are formed via neutralization.',
                'Genetics is founded on Mendel’s laws of inheritance. In humans, DNA double-helix holds the genetic code; mutations and gene expression govern physiological adaptations.',
                'Ecosystem food chains show energy flow following Lindeman’s 10% law: only 10% of energy is transferred to the next trophic level, with the rest lost as metabolic heat.',
              ],
              practiceQuestions: [
                {
                  id: 'gs-q3',
                  question: 'Which vitamin deficiency is primarily responsible for Pernicious Anemia in humans?',
                  options: ['Vitamin B1 (Thiamine)', 'Vitamin B12 (Cobalamin)', 'Vitamin C (Ascorbic acid)', 'Vitamin D (Calciferol)'],
                  correctAnswer: 1,
                  explanation: 'Vitamin B12 (Cyanocobalamin) deficiency leads to Pernicious Anemia due to impairment in red blood cell maturation.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      unitNumber: 'Unit II',
      title: 'Geography of India',
      tamilTitle: 'அலகு II: இந்தியாவின் புவியியல்',
      questionCount: 5,
      standard: 'Degree Standard',
      officialTopics: [
        'Location - Physical features - Monsoon, rainfall, weather and climate - Water resources - Rivers in India',
        'Soil, Minerals and Natural Resources - Forest and Wildlife - Agricultural pattern; Transport – Communication',
        'Social Geography – Population density and distribution - Racial, linguistic groups and major tribes',
        'Natural calamity - Disaster management; Environmental pollution - Climate change - Green energy',
      ],
      chapters: [
        {
          id: 'gs-u2-c1',
          chapterNumber: 1,
          title: 'Physical Features, Climate, Rivers & Resources',
          tamilTitle: 'இயற்கை அமைவுகள், காலநிலை, ஆறுகள் மற்றும் வளங்கள்',
          lessons: [
            {
              id: 'gs-u2-c1-l1',
              lessonNumber: '2.1',
              title: 'Indian Monsoons, River Systems & Mineral Belts',
              duration: '35 mins',
              keyConcepts: ['South-West Monsoon', 'North-East Monsoon (Tamil Nadu Rainfall)', 'Himalayan vs Peninsular Rivers', 'Chota Nagpur Plateau'],
              studyNotes: [
                'India\'s climate is tropical monsoon. Tamil Nadu receives the bulk of its annual rainfall (around 48%) from the retreating North-East Monsoon between October and December.',
                'Indian river systems divide into perennial Himalayan rivers (Ganga, Indus, Brahmaputra) and rain-fed Peninsular rivers (Godavari, Krishna, Cauvery, Mahanadi).',
                'Black cotton soil (Regur) is rich in iron, lime, and calcium, ideal for cotton cultivation in the Deccan trap; alluvial soils dominate the Indo-Gangetic and coastal plains.',
              ],
              practiceQuestions: [
                {
                  id: 'gs-q4',
                  question: 'Tamil Nadu receives the maximum portion of its annual rainfall from which monsoon system?',
                  options: ['South-West Monsoon', 'North-East Monsoon', 'Western Disturbances', 'Pre-monsoon showers'],
                  correctAnswer: 1,
                  explanation: 'Tamil Nadu lies in the rain-shadow region during the South-West Monsoon and derives almost half of its rainfall from the North-East (retreating) Monsoon.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 3,
      unitNumber: 'Unit III',
      title: 'History, Culture of India & National Movement',
      tamilTitle: 'அலகு III: இந்தியாவின் வரலாறு, பண்பாடு மற்றும் தேசிய இயக்கம்',
      questionCount: 10,
      standard: 'Degree Standard',
      officialTopics: [
        'Indus Valley Civilization - Guptas, Delhi Sultans, Mughals, Marathas - Age of Vijayanagaram and Bahmani Kingdoms - South Indian History',
        'National Renaissance - Early uprising against British rule - Indian National Congress - Emergence of leaders',
        'Different modes of agitation: Growth of Satyagraha and Militant Movements; Communalism and Partition',
        'Characteristics of Indian Culture, Unity in Diversity – Race, Language, Custom; India as a secular state',
      ],
      chapters: [
        {
          id: 'gs-u3-c1',
          chapterNumber: 1,
          title: 'Ancient & Medieval India to National Renaissance',
          tamilTitle: 'பண்டைய மற்றும் இடைக்கால இந்தியா முதல் தேசிய மறுமலர்ச்சி வரை',
          lessons: [
            {
              id: 'gs-u3-c1-l1',
              lessonNumber: '3.1',
              title: 'Indus Valley Civilization, Chola Administration & Freedom Struggle',
              duration: '45 mins',
              keyConcepts: ['Harappan Town Planning', 'Kudavolai System', '1857 Revolt', 'Gandhi, Nehru, Ambedkar, Bharathiar & Periyar'],
              studyNotes: [
                'Indus Valley Civilization was an urban Bronze Age civilization marked by gridiron street plans, burnt brick structures, underground drainage, and the Great Bath of Mohenjo-daro.',
                'The Imperial Cholas developed sophisticated local self-government documented in the Parantaka I inscriptions at Uttiramerur detailing ward committees and Kudavolai ballot systems.',
                'The Indian National Movement progressed from constitutional agitation (1885–1905) to Swadeshi & militant nationalism (1905–1919) and the Gandhian mass movements (Non-Cooperation, Civil Disobedience, Quit India).',
              ],
              practiceQuestions: [
                {
                  id: 'gs-q5',
                  question: 'The famous Uttiramerur Inscriptions from Kanchipuram provide historical evidence of village administration during the reign of which Chola king?',
                  options: ['Rajaraja Chola I', 'Rajendra Chola I', 'Parantaka Chola I', 'Kulothunga Chola I'],
                  correctAnswer: 2,
                  explanation: 'The Uttiramerur inscriptions belong to Parantaka Chola I (dated 919 and 921 AD) and detail the democratic Kudavolai election system for village assemblies.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 4,
      unitNumber: 'Unit IV',
      title: 'Indian Polity',
      tamilTitle: 'அலகு IV: இந்திய ஆட்சியியல்',
      questionCount: 15,
      standard: 'Degree Standard',
      officialTopics: [
        'Constitution of India - Preamble - Salient features - Union, State and Union Territory',
        'Citizenship, Fundamental Rights, Fundamental Duties, Directive Principles of State Policy',
        'Union Executive, Union Legislature - State Executive, State Legislature - Local Governments, Panchayat Raj',
        'Spirit of federalism: Centre - State relationships - Election - Judiciary - Rule of Law - Anti-corruption measures, Lokpal, RTI, Human Rights',
      ],
      chapters: [
        {
          id: 'gs-u4-c1',
          chapterNumber: 1,
          title: 'Constitutional Foundations, Executive & Legislative Systems',
          tamilTitle: 'அரசியலமைப்பு அடிப்படைகள் மற்றும் நிர்வாக முறைமை',
          lessons: [
            {
              id: 'gs-u4-c1-l1',
              lessonNumber: '4.1',
              title: 'Preamble, Fundamental Rights, DPSP & Centre-State Federalism',
              duration: '50 mins',
              keyConcepts: ['Preamble Key Words', 'Articles 14 to 32', 'Article 51A Duties', '73rd & 74th Amendments', 'Rajamannar Committee'],
              studyNotes: [
                'The Preamble declares India a Sovereign, Socialist, Secular, Democratic, Republic and guarantees Justice, Liberty, Equality, and Fraternity.',
                'Fundamental Rights (Part III, Articles 12-35) are enforceable in courts via writ jurisdiction under Article 32 (Supreme Court) and Article 226 (High Courts).',
                'Panchayati Raj was constitutionally institutionalized through the 73rd Constitutional Amendment Act, 1992, introducing Part IX and the Eleventh Schedule.',
                'Tamil Nadu was a pioneer in advocating Centre-State federal balance, instituting the Justice P.V. Rajamannar Committee in 1969 to inspect state autonomy.',
              ],
              practiceQuestions: [
                {
                  id: 'gs-q6',
                  question: 'Which constitutional writ is issued by High Courts or the Supreme Court to prevent an inferior tribunal or court from exceeding its legal jurisdiction?',
                  options: ['Habeas Corpus', 'Mandamus', 'Prohibition', 'Quo-Warranto'],
                  correctAnswer: 2,
                  explanation: 'A writ of Prohibition is issued by a higher court to a lower court or tribunal to prevent it from usurping or exceeding its jurisdiction.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 5,
      unitNumber: 'Unit V',
      title: 'Indian Economy & Development Administration in Tamil Nadu',
      tamilTitle: 'அலகு V: இந்தியப் பொருளாதாரம் மற்றும் தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்',
      questionCount: 20,
      standard: 'Degree Standard',
      officialTopics: [
        'Nature of Indian Economy – Five-year plan models - Planning Commission and Niti Aayog - Sources of revenue, RBI, Fiscal and Monetary Policy, GST',
        'Land Reforms and Agriculture - Application of Science in Agriculture - Industrial growth - Rural welfare programmes - Poverty & Employment',
        'Human Development Indicators in Tamil Nadu & comparative national assessment - Social reform movements, welfare schemes, reservation policy',
        'Economic trends in Tamil Nadu - Education and health systems - e-Governance - Public delivery systems (PDS)',
      ],
      chapters: [
        {
          id: 'gs-u5-c1',
          chapterNumber: 1,
          title: 'Macro Economy, NITI Aayog & Tamil Nadu Growth Model',
          tamilTitle: 'பேரியல் பொருளாதாரம் மற்றும் தமிழ்நாட்டின் வளர்ச்சி மாதிரி',
          lessons: [
            {
              id: 'gs-u5-c1-l1',
              lessonNumber: '5.1',
              title: 'Fiscal Policy, GST, HDI & Tamil Nadu Social Welfare Models',
              duration: '50 mins',
              keyConcepts: ['GST Council', 'NITI Aayog Sustainable Development Goals', 'Tamil Nadu Model of Development', 'Universal PDS & Noon Meal Scheme'],
              studyNotes: [
                'NITI Aayog (National Institution for Transforming India) replaced the Planning Commission on January 1, 2015, acting as the premier policy think tank operating with cooperative federalism.',
                'Tamil Nadu has achieved exceptional Human Development Indicators (HDI) through inclusive social welfare investments: pioneer of the Mid-Day Meal Scheme (expanded by Kamarajar and MGR), Universal Public Distribution System (PDS), and high Gross Enrolment Ratio (GER) in higher education.',
                'The Tamil Nadu model combines rapid industrialization (leading automobile and textiles manufacturing clusters) with targeted social justice programs.',
              ],
              practiceQuestions: [
                {
                  id: 'gs-q7',
                  question: 'Under NITI Aayog’s SDG India Index, Tamil Nadu consistently excels at the national level especially in which development indicators?',
                  options: ['Poverty Reduction & Good Health', 'Mining output', 'Forest timber trade', 'Deep coal exploration'],
                  correctAnswer: 0,
                  explanation: 'Tamil Nadu ranks consistently near the top in Goal 1 (No Poverty) and Goal 3 (Good Health and Well-being) owing to its universal welfare and public health infrastructure.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 6,
      unitNumber: 'Unit VI',
      title: 'History, Culture, Heritage & Socio-Political Movements in TN',
      tamilTitle: 'அலகு VI: தமிழ்நாட்டின் வரலாறு, பண்பாடு, மரபு மற்றும் சமூக-அரசியல் இயக்கங்கள்',
      questionCount: 20,
      standard: 'Degree Standard',
      officialTopics: [
        'History of Tamil Society, related archaeological discoveries, Tamil literature from Sangam age till contemporary times',
        'Thirukkural - Significance as secular literature - Relevance to everyday life, humanity, universal values, socio-politico-economic affairs',
        'Role of Tamil Nadu in freedom struggle - Early agitations against British Rule - Role of women in freedom struggle',
        'Evolution of 19th and 20th century socio-political movements in TN - Justice Party, Self Respect Movement, Dravidian Movement, Thanthai Periyar & Perarignar Anna',
      ],
      chapters: [
        {
          id: 'gs-u6-c1',
          chapterNumber: 1,
          title: 'Archaeology, Thirukkural & Socio-Political Movements',
          tamilTitle: 'தொல்லியல் கண்டுபிடிப்புகள், திருக்குறள் மற்றும் திராவிட இயக்கங்கள்',
          lessons: [
            {
              id: 'gs-u6-c1-l1',
              lessonNumber: '6.1',
              title: 'Keeladi Excavations, Thirukkural Values & Dravidian Renaissance',
              duration: '50 mins',
              keyConcepts: ['Keeladi Archaeological Site', 'Thirukkural Secular Humanism', 'Velu Nachiyar & Rani Mangammal', 'Justice Party (1916) & Self Respect Movement (1925)'],
              studyNotes: [
                'Keeladi excavations on the banks of the Vaigai river in Sivagangai district pushed the antiquity of the Sangam Age to 6th century BCE, demonstrating an urban literacy-rich society with Tamil-Brahmi scripts.',
                'Thirukkural, authored by Thiruvalluvar, stands out as secular universal literature devoid of theological bias, focusing on Aram (Virtue), Porul (Wealth/Governance), and Inbam (Love).',
                'Rani Velu Nachiyar of Sivagangai was the first Indian queen to actively fight and defeat British forces (1780), utilizing organized guerrilla strategy and Commander Kuyili’s supreme sacrifice.',
                'The South Indian Liberal Federation (Justice Party) formed in 1916 laid the foundation for the Communal Government Order (1921) introducing reservations. Thanthai Periyar founded the Self-Respect Movement in 1925 championing gender equality, rationalism, and social justice.',
              ],
              practiceQuestions: [
                {
                  id: 'gs-q8',
                  question: 'Which prominent archaeological excavation site in Tamil Nadu has provided radiocarbon dating evidence placing the urban Sangam era back to the 6th Century BCE?',
                  options: ['Adichanallur', 'Keeladi', 'Arikamedu', 'Kodumanal'],
                  correctAnswer: 1,
                  explanation: 'Carbon dating of artifacts recovered from Keeladi in Sivagangai district firmly establishes the presence of an advanced urban civilization in Tamil Nadu by the 6th century BCE.',
                },
                {
                  id: 'gs-q9',
                  question: 'Who was the first Indian queen to wage an armed war and successfully reclaim her kingdom from the British East India Company in 1780?',
                  options: ['Rani Mangammal', 'Rani Velu Nachiyar', 'Rani Lakshmibai', 'Kittur Chennamma'],
                  correctAnswer: 1,
                  explanation: 'Rani Velu Nachiyar of Sivagangai waged war with the support of Hyder Ali and Gopala Nayakar and recaptured Sivagangai from the British in 1780.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// -------------------------------------------------------------
// SUBJECT 2: Aptitude (SSLC Standard - 25 Questions)
// -------------------------------------------------------------
const aptitudeSubject: Group2Subject = {
  id: 'aptitude',
  order: 2,
  title: 'Aptitude and Mental Ability',
  tamilTitle: 'திறனறிவும் மனக்கணக்கு நுண்ணறிவும்',
  partTag: 'Part B • SSLC Standard',
  standard: 'SSLC Standard (10th Standard)',
  questionCount: 25,
  description:
    'Covers Quantitative Aptitude (Simplification, Percentage, HCF & LCM, Ratio, Simple & Compound Interest, Area, Volume, Time & Work) and Mental Ability (Logical Reasoning, Puzzles, Dice, Visual & Alpha-numeric Reasoning).',
  accentColor: '#fbbf24',
  units: [
    {
      id: 1,
      unitNumber: 'Unit I',
      title: 'Aptitude',
      tamilTitle: 'அலகு I: திறனறிவு',
      questionCount: 15,
      standard: 'SSLC Standard',
      officialTopics: [
        'Simplification - Percentage - Highest Common Factor (HCF) - Lowest Common Multiple (LCM)',
        'Ratio and Proportion - Simple interest - Compound interest',
        'Area - Volume - Time and Work',
      ],
      chapters: [
        {
          id: 'apt-u1-c1',
          chapterNumber: 1,
          title: 'Simplification, Percentage, HCF & LCM',
          tamilTitle: 'சுருக்குதல், விழுக்காடு, மீப்பெரு பொதுக் காரணி மற்றும் மீச்சிறு பொது மடங்கு',
          lessons: [
            {
              id: 'apt-u1-c1-l1',
              lessonNumber: '1.1',
              title: 'BODMAS, Fractions, Percentages & Divisibility Rules',
              duration: '35 mins',
              keyConcepts: ['BODMAS Rule', 'Percentage to Fraction conversion', 'HCF x LCM = Product of Two Numbers', 'Prime Factorization'],
              studyNotes: [
                'BODMAS dictates calculation priority: Brackets, Orders (powers/roots), Division, Multiplication, Addition, Subtraction.',
                'Percentage represents a ratio with base 100: x% of Y = (x * Y) / 100. Rapid mental math shortcuts: 10% = 1/10, 25% = 1/4, 33.33% = 1/3, 50% = 1/2.',
                'The Golden Relation for any two numbers A and B: HCF(A, B) * LCM(A, B) = A * B.',
              ],
              practiceQuestions: [
                {
                  id: 'apt-q1',
                  question: 'The product of two numbers is 2160 and their HCF is 12. What is their LCM?',
                  options: ['120', '180', '240', '360'],
                  correctAnswer: 1,
                  explanation: 'Since HCF * LCM = Product of two numbers: 12 * LCM = 2160 => LCM = 2160 / 12 = 180.',
                },
                {
                  id: 'apt-q2',
                  question: 'If 35% of a number is 175, what is 80% of that number?',
                  options: ['350', '400', '450', '500'],
                  correctAnswer: 1,
                  explanation: 'Let the number be N. 0.35 * N = 175 => N = 175 / 0.35 = 500. Therefore, 80% of 500 = 0.8 * 500 = 400.',
                },
              ],
            },
          ],
        },
        {
          id: 'apt-u1-c2',
          chapterNumber: 2,
          title: 'Ratio, Interest, Mensuration & Time-Work',
          tamilTitle: 'விகிதம், வட்டி, அளவியல் மற்றும் காலம்-வேலை',
          lessons: [
            {
              id: 'apt-u1-c2-l1',
              lessonNumber: '1.2',
              title: 'Simple/Compound Interest, 2D/3D Mensuration & Work Formulae',
              duration: '45 mins',
              keyConcepts: ['Simple Interest = P*N*R/100', 'CI Difference for 2 Years = P(R/100)^2', 'Time & Work Unitary Method', 'Cylinder & Sphere Volume'],
              studyNotes: [
                'Simple Interest (SI) is calculated solely on original principal: SI = (P * N * R) / 100.',
                'Difference between Compound Interest (CI) and Simple Interest (SI) for 2 years at rate R% is: Diff = P * (R / 100)^2.',
                'Time and Work unitary rule: If A completes a work in \'x\' days and B in \'y\' days, together they complete it in (x * y) / (x + y) days.',
              ],
              practiceQuestions: [
                {
                  id: 'apt-q3',
                  question: 'A can finish a job in 12 days and B can finish the same job in 24 days. How many days will they take working together?',
                  options: ['6 days', '8 days', '10 days', '14 days'],
                  correctAnswer: 1,
                  explanation: 'Together work time = (A * B) / (A + B) = (12 * 24) / (12 + 24) = 288 / 36 = 8 days.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      unitNumber: 'Unit II',
      title: 'Reasoning',
      tamilTitle: 'அலகு II: காரணவியல்',
      questionCount: 10,
      standard: 'SSLC Standard',
      officialTopics: [
        'Logical reasoning - Puzzles - Dice',
        'Visual reasoning - Alpha numeric reasoning - Number series',
      ],
      chapters: [
        {
          id: 'apt-u2-c1',
          chapterNumber: 1,
          title: 'Logical, Visual & Alpha-Numeric Reasoning',
          tamilTitle: 'தருக்கவியல், காட்சி மற்றும் எண் எழுத்துக் காரணவியல்',
          lessons: [
            {
              id: 'apt-u2-c1-l1',
              lessonNumber: '2.1',
              title: 'Dice Problems, Missing Number Series & Pattern Analysis',
              duration: '35 mins',
              keyConcepts: ['Opposite Faces of a Standard Dice', 'Arithmetic & Geometric Series', 'Letter Position Values (A=1 ... Z=26)', 'Matrix Pattern Decoding'],
              studyNotes: [
                'In standard dice, the sum of numbers on opposite faces always equals 7 (1 opposite 6, 2 opposite 5, 3 opposite 4).',
                'Number series identification patterns: difference of differences, prime numbers, squares & cubes (n^2 +/- 1, n^3 +/- 1), alternating operations.',
                'Alpha-numeric series rely on standard forward position numbers (A=1, M=13, Z=26) and reverse values (A=26, Z=1).',
              ],
              practiceQuestions: [
                {
                  id: 'apt-q4',
                  question: 'Find the missing number in the sequence: 4, 9, 25, 49, 121, ___',
                  options: ['144', '169', '196', '225'],
                  correctAnswer: 1,
                  explanation: 'The sequence consists of squares of consecutive prime numbers: 2^2=4, 3^2=9, 5^2=25, 7^2=49, 11^2=121, 13^2=169.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// -------------------------------------------------------------
// SUBJECT 3: General English (SSLC Standard - 100 Questions)
// -------------------------------------------------------------
const generalEnglishSubject: Group2Subject = {
  id: 'general-english',
  order: 3,
  title: 'General English',
  tamilTitle: 'பொது ஆங்கிலம்',
  partTag: 'Part C • SSLC Standard',
  standard: 'SSLC Standard (10th Standard)',
  questionCount: 100,
  description:
    'Complete SSLC language syllabus consisting of Grammar (25 Qs), Vocabulary (15 Qs), Writing Skills (10 Qs), Technical Terms (10 Qs), Reading Comprehension (20 Qs), Translation (5 Qs), and Literary Works (15 Qs).',
  accentColor: '#ec4899',
  units: [
    {
      id: 1,
      unitNumber: 'Unit I',
      title: 'Grammar',
      tamilTitle: 'அலகு I: இலக்கணம்',
      questionCount: 25,
      standard: 'SSLC Standard',
      officialTopics: [
        'Parts of speech, Concord, Tense, Active voice and passive voice',
        'Types of sentences: Statement, Interrogative, Imperative, Exclamatory and transformations',
        'Verbs, Main & Auxiliary, Regular/Irregular, Infinitives, Gerunds, Participles, Question tags',
        'Sentence patterns, Simple/Compound/Complex, Phrases & clauses, Degrees of comparison, Direct & Indirect speech',
      ],
      chapters: [
        {
          id: 'ge-u1-c1',
          chapterNumber: 1,
          title: 'Parts of Speech, Concord, Tenses & Voices',
          lessons: [
            {
              id: 'ge-u1-c1-l1',
              lessonNumber: '1.1',
              title: 'Subject-Verb Agreement, Active-Passive Voice & Tense Mastery',
              duration: '40 mins',
              keyConcepts: ['Rules of Concord', 'Passive Voice Formations', 'Simple/Continuous/Perfect Tenses', 'Question Tags (Positive statement = Negative tag)'],
              studyNotes: [
                'Subject-Verb Agreement: When two singular nouns are joined by "either...or" / "neither...nor", the verb agrees with the nearer subject.',
                'Active into Passive Voice: The object of the active verb becomes the subject of the passive verb with appropriate auxiliary verb + V3 (Past Participle).',
                'Question tags follow inversion: Affirmative sentences take negative tags ("She is reading, isn\'t she?"), and negative sentences take positive tags ("They haven\'t finished, have they?").',
              ],
              practiceQuestions: [
                {
                  id: 'ge-q1',
                  question: 'Choose the correct question tag: "You can speak Tamil fluently, ______?"',
                  options: ['can\'t you', 'can you', 'do you', 'don\'t you'],
                  correctAnswer: 0,
                  explanation: 'The sentence is positive and uses the modal auxiliary "can", so the correct tag is the negative form "can\'t you?".',
                },
                {
                  id: 'ge-q2',
                  question: 'Identify the sentence pattern for: "They named the baby Dorothy."',
                  options: ['S V O', 'S V IO DO', 'S V O C', 'S V A'],
                  correctAnswer: 2,
                  explanation: '"They" (Subject) "named" (Verb) "the baby" (Object) "Dorothy" (Complement). Hence S V O C.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      unitNumber: 'Unit II',
      title: 'Vocabulary',
      tamilTitle: 'அலகு II: சொல்லகராதி',
      questionCount: 15,
      standard: 'SSLC Standard',
      officialTopics: [
        'Synonyms, Antonyms, Homonyms, Homophones, Collocations, Idioms & Phrases, Phrasal verbs',
        'Spelling of words, Correct usage of words, One word substitution, Word creation',
        'Singular and plural (including Zero plural), Derivatives, Abbreviations, British and American English, Figures of speech',
      ],
      chapters: [
        {
          id: 'ge-u2-c1',
          chapterNumber: 1,
          title: 'Idioms, Phrasal Verbs & Word Formations',
          lessons: [
            {
              id: 'ge-u2-c1-l1',
              lessonNumber: '2.1',
              title: 'Phrasal Verbs, One-Word Substitutes & British/American Terms',
              duration: '35 mins',
              keyConcepts: ['Call off / Put off distinctions', 'Zero Plural nouns (sheep, deer, fish)', 'British vs American English (bonnet/hood, lift/elevator)'],
              studyNotes: [
                'Phrasal verbs combine a base verb with a preposition/adverb: "Call off" means cancel; "Put off" means postpone.',
                'Zero plural nouns retain identical forms in singular and plural: sheep, deer, salmon, aircraft, offspring.',
                'British vs American equivalents: Flat = Apartment, Biscuit = Cookie, Pavement = Sidewalk, Petrol = Gasoline, Boot = Trunk.',
              ],
              practiceQuestions: [
                {
                  id: 'ge-q3',
                  question: 'What is the American English equivalent for the British term "Pavement"?',
                  options: ['Highway', 'Sidewalk', 'Subway', 'Driveway'],
                  correctAnswer: 1,
                  explanation: 'The British English word "Pavement" corresponds to "Sidewalk" in American English.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 3,
      unitNumber: 'Unit III',
      title: 'Writing Skills',
      tamilTitle: 'அலகு III: எழுதும் திறன்',
      questionCount: 10,
      standard: 'SSLC Standard',
      officialTopics: [
        'Letter writing (formal and informal) – Types of Letters',
        'Jumbled sentences - Finding out the right order of sentences',
        'Making queries, Inferences, Blanks, Substitutions',
      ],
      chapters: [
        {
          id: 'ge-u3-c1',
          chapterNumber: 1,
          title: 'Formal/Informal Correspondence & Sentence Ordering',
          lessons: [
            {
              id: 'ge-u3-c1-l1',
              lessonNumber: '3.1',
              title: 'Official Letter Writing Conventions & Logical Sentence Sequencing',
              duration: '30 mins',
              keyConcepts: ['Subscription formats', 'Salutation rules', 'Chronological paragraph cohesion'],
              studyNotes: [
                'Formal letters to authorities or editors require "Yours faithfully" or "Yours truly", without an apostrophe in "Yours".',
                'Informal letters to friends and family use informal subscriptions like "Yours affectionately" or "With love".',
                'Sentence jumble strategy: locate the topic sentence containing the primary noun, followed by explanatory clauses and pronoun references.',
              ],
              practiceQuestions: [
                {
                  id: 'ge-q4',
                  question: 'Which of the following is the grammatically correct complimentary close for a formal official letter?',
                  options: ['Your\'s faithfully', 'Yours faithfully', 'Yours\' faithfully', 'Yours friendly'],
                  correctAnswer: 1,
                  explanation: '"Yours" is an independent possessive pronoun and must never take an apostrophe.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 4,
      unitNumber: 'Unit IV',
      title: 'Technical Terms',
      tamilTitle: 'அலகு IV: தொழில்நுட்பக் கலைச்சொற்கள்',
      questionCount: 10,
      standard: 'SSLC Standard',
      officialTopics: [
        'Administrative Terms, Department related, General and Official terms',
        'Official Correspondence (only basics)',
      ],
      chapters: [
        {
          id: 'ge-u4-c1',
          chapterNumber: 1,
          title: 'Administrative & Governance Terminology',
          lessons: [
            {
              id: 'ge-u4-c1-l1',
              lessonNumber: '4.1',
              title: 'Official Departmental Jargon & Government Procedure Terms',
              duration: '30 mins',
              keyConcepts: ['Gazette', 'Memorandum', 'Ad-hoc', 'Quorum', 'Vesting'],
              studyNotes: [
                'Administrative vocabulary in government offices: "Gazette" is the official government public journal of legal records; "Quorum" is the minimum attendance required to conduct proceedings.',
                '"Ad-hoc" signifies formed for a particular purpose only; "De jure" means by right according to law; "De facto" means in fact or practice.',
              ],
              practiceQuestions: [
                {
                  id: 'ge-q5',
                  question: 'What is the term used to denote the minimum number of members required to validate proceedings of an official committee or assembly?',
                  options: ['Plurality', 'Quorum', 'Consensus', 'Affidavit'],
                  correctAnswer: 1,
                  explanation: '"Quorum" designates the minimum number of voting members that must be present at a meeting of any body to make proceedings legally valid.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 5,
      unitNumber: 'Unit V',
      title: 'Reading Comprehension',
      tamilTitle: 'அலகு V: வாசித்தல் – புரிந்து கொள்ளும் திறன்',
      questionCount: 20,
      standard: 'SSLC Standard',
      officialTopics: [
        'Unseen passages (News Paper, Headlines, Editorials, Government related News)',
        'Question Types - Strong question, Weak question, Match the following, Sentence Completion, Ascertainment of facts',
      ],
      chapters: [
        {
          id: 'gs-u5-c1-en',
          chapterNumber: 1,
          title: 'Critical Passage Analysis & Fact Ascertainment',
          lessons: [
            {
              id: 'ge-u5-c1-l1',
              lessonNumber: '5.1',
              title: 'Editorial Analysis, Inferences & Passage Answering Techniques',
              duration: '35 mins',
              keyConcepts: ['Central Idea identification', 'Direct vs Indirect Inferences', 'Tone of the Author'],
              studyNotes: [
                'Read the questions first before skimming the passage to prime your mind for dates, names, causal links, and conclusions.',
                'Distinguish between factual statement questions (explicit text) and inference questions (derived meaning from context).',
              ],
              practiceQuestions: [
                {
                  id: 'ge-q6',
                  question: 'When asked for the "tone of the author" in an editorial analyzing civic infrastructure gaps, which term is most applicable?',
                  options: ['Fictional', 'Critical and Analytical', 'Humorous', 'Sarcastic'],
                  correctAnswer: 1,
                  explanation: 'Editorials assessing policy failures or infrastructural issues maintain a critical and analytical perspective.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 6,
      unitNumber: 'Unit VI',
      title: 'Translation',
      tamilTitle: 'அலகு VI: மொழிபெயர்ப்பு',
      questionCount: 5,
      standard: 'SSLC Standard',
      officialTopics: [
        'Word Translation, Sentence Translation',
        'Tense related translation tasks, Tense / Voice related tasks',
      ],
      chapters: [
        {
          id: 'ge-u6-c1',
          chapterNumber: 1,
          title: 'Syntax Conversion & Word Equivalents',
          lessons: [
            {
              id: 'ge-u6-c1-l1',
              lessonNumber: '6.1',
              title: 'English to Tamil Syntactic Transformation (SVO to SOV)',
              duration: '30 mins',
              keyConcepts: ['English SVO structure vs Tamil SOV structure', 'Idiomatic accuracy over verbatim translation'],
              studyNotes: [
                'English follows Subject + Verb + Object (SVO), while Tamil follows Subject + Object + Verb (SOV). Example: "He wrote a letter" (SVO) translates to "அவன் கடிதம் எழுதினான்" (SOV).',
                'Avoid literal translation of idioms: "Once in a blue moon" translates idiomatically as "அரிதினும் அரிதாக", not word-for-word.',
              ],
              practiceQuestions: [
                {
                  id: 'ge-q7',
                  question: 'Translate accurately into Tamil: "The meeting has been postponed."',
                  options: ['கூட்டம் ரத்து செய்யப்பட்டது', 'கூட்டம் தள்ளிவைக்கப்பட்டுள்ளது', 'கூட்டம் முடிந்துவிட்டது', 'கூட்டம் தொடங்குகிறது'],
                  correctAnswer: 1,
                  explanation: '"Postponed" means தள்ளிவைக்கப்பட்டுள்ளது (put off to a future date), whereas "cancelled" means ரத்து செய்யப்பட்டது.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 7,
      unitNumber: 'Unit VII',
      title: 'Literary Works',
      tamilTitle: 'அலகு VII: இலக்கியப் படைப்புகள் (பாடநூல்)',
      questionCount: 15,
      standard: 'SSLC Standard (School Textbooks)',
      officialTopics: [
        'Figures of Speech; Appreciation and Analysis of Poetry; Lines of Significance',
        'Prescribed Poems: I Dream of Spices, The Crocodile, Teamwork, From a Railway Carriage, Stopping by Woods on a Snowy Evening, A Poison Tree, etc.',
        'Prescribed Prose: His First Flight, The Night the Ghost Got In, The Attic, The Dying Detective, Water – The Elixir of Life, etc.',
      ],
      chapters: [
        {
          id: 'ge-u7-c1',
          chapterNumber: 1,
          title: 'Prescribed School Poems & Prose Works',
          lessons: [
            {
              id: 'ge-u7-c1-l1',
              lessonNumber: '7.1',
              title: 'Robert Frost, Lewis Carroll, Liam O\'Flaherty & C.V. Raman Works',
              duration: '45 mins',
              keyConcepts: [
                '"Stopping by Woods on a Snowy Evening" - Robert Frost',
                '"Water - The Elixir of Life" - Sir C.V. Raman',
                '"His First Flight" - Liam O\'Flaherty',
                'Metaphor, Simile, Personification, Alliteration',
              ],
              studyNotes: [
                'Robert Frost\'s iconic lines: "The woods are lovely, dark and deep, / But I have promises to keep, / And miles to go before I sleep." (Metaphor for life\'s responsibilities before death).',
                'Sir C.V. Raman in "Water – The Elixir of Life" illustrates water as the true nectar of life holding the key to soil fertility, agriculture, and human survival.',
                'Liam O\'Flaherty\'s "His First Flight" symbolizes courage and self-reliance, depicting a young seagull conquering fear to take flight.',
              ],
              practiceQuestions: [
                {
                  id: 'ge-q8',
                  question: 'Who authored the renowned poem containing the lines: "The woods are lovely, dark and deep, But I have promises to keep, And miles to go before I sleep"?',
                  options: ['William Wordsworth', 'Robert Frost', 'William Blake', 'John Masefield'],
                  correctAnswer: 1,
                  explanation: 'These famous lines conclude Robert Frost\'s poem "Stopping by Woods on a Snowy Evening".',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// -------------------------------------------------------------
// SUBJECT 4: General Tamil (பகுதி இ: பொதுத்தமிழ் - SSLC Standard – 100 Questions)
// -------------------------------------------------------------
const generalTamilSubject: Group2Subject = {
  id: 'general-tamil',
  order: 4,
  title: 'General Tamil',
  tamilTitle: 'பொதுத் தமிழ்',
  partTag: 'பகுதி இ • பத்தாம் வகுப்புத் தரம்',
  standard: 'பத்தாம் வகுப்புத் தரம் (SSLC Standard)',
  questionCount: 100,
  description:
    'பத்தாம் வகுப்புத் தரத்திலான பொதுத்தமிழ் முழுப் பாடத்திட்டம்: அலகு 1 முதல் அலகு 7 வரை (இலக்கணம் 25 வினாக்கள், சொல்லகராதி 15 வினாக்கள், எழுதும் திறன் 15 வினாக்கள், கலைச் சொற்கள் 10 வினாக்கள், வாசித்தல் 15 வினாக்கள், மொழிபெயர்ப்பு 5 வினாக்கள், இலக்கியம் & தமிழறிஞர்கள் 15 வினாக்கள்).',
  accentColor: '#10b981',
  units: [
    {
      id: 1,
      unitNumber: 'அலகு I',
      title: 'இலக்கணம்',
      tamilTitle: 'அலகு I: இலக்கணம்',
      questionCount: 25,
      standard: 'பத்தாம் வகுப்புத் தரம்',
      officialTopics: [
        'எழுத்து: பிரித்து எழுதுதல் – சேர்த்து எழுதுதல் – சந்திப்பிழை – குறில், நெடில் வேறுபாடு – லகர, ளகர, ழகர வேறுபாடு – னகர, ணகர வேறுபாடு – ரகர, றகர வேறுபாடு – இனவெழுத்துகள் அறிதல் – சுட்டு எழுத்துகள் – வினா எழுத்துகள் – ஒருமைப் பன்மை அறிதல்',
        'சொல்: வேர்ச்சொல் அறிதல் – வேர்ச்சொல்லில் இருந்து வினைமுற்று, வினையெச்சம், வினையாலணையும் பெயர், பெயரெச்சம் வகை அறிதல் – அயற்சொல் – தமிழ்ச்சொல், எதிர்ச்சொல் – வினைச்சொல் – எழுத்துப் பிழை, ஒற்றுப்பிழை அறிதல் – இரண்டு வினைச் சொற்களின் வேறுபாடு அறிதல்',
      ],
      chapters: [
        {
          id: 'gt-u1-c1',
          chapterNumber: 1,
          title: 'எழுத்திலக்கணம் மற்றும் சொல்லிலக்கணம்',
          tamilTitle: 'எழுத்து & சொல் இலக்கண விதிகள்',
          lessons: [
            {
              id: 'gt-u1-c1-l1',
              lessonNumber: '1.1',
              title: 'எழுத்து வேறுபாடுகள், வேர்ச்சொல் & எச்ச-முற்று வகைகள்',
              duration: '40 நிமிடங்கள்',
              keyConcepts: ['சுட்டு எழுத்துகள் (அ, இ, உ)', 'வினா எழுத்துகள் (எ, யா, ஆ, ஓ, ஏ)', 'வேர்ச்சொல் அறிதல்', 'பெயரெச்சம் (வந்த பையன்) vs வினையெச்சம் (வந்து போனான்)'],
              studyNotes: [
                'சுட்டு எழுத்துகள்: அ, இ, உ (அவன், இவள்). வினா எழுத்துகள்: எ, யா (மொழி முதலிலும்), ஆ, ஓ (மொழி இறுதியிலும்), ஏ (இருவழியிலும்).',
                'வேர்ச்சொல் என்பது ஏவல் வினையாக அமையும்: "பாடினான்" என்பதன் வேர்ச்சொல் "பாடு"; "ஓடினான்" என்பதன் வேர்ச்சொல் "ஓடு".',
                'பெயரெச்சம் என்பது பெயரைக் கொண்டு முடியும் எச்சவினை (எ.கா: படித்த மாணவன்). வினையெச்சம் என்பது வினையைக் கொண்டு முடியும் எச்சவினை (எ.கா: படித்து முடித்தான்).',
              ],
              practiceQuestions: [
                {
                  id: 'gt-q1',
                  question: '"கண்டான்" என்னும் சொல்லின் வேர்ச்சொல் யாது?',
                  options: ['கண்', 'காண்', 'கண்ட', 'காணுதல்'],
                  correctAnswer: 1,
                  explanation: '"கண்டான்" என்பதன் மூல ஏவல் வினையான வேர்ச்சொல் "காண்" ஆகும்.',
                },
                {
                  id: 'gt-q2',
                  question: 'சொற்களில் வல்லினம் மிகும் இடங்களுள் சரியானது எது?',
                  options: ['இரண்டாம் வேற்றுமை உருபாகிய "ஐ" வெளிப்படும் தொடரில் மிகும்', 'வினைத்தொகையில் வல்லினம் மிகும்', 'உம்மைத்தொகையில் வல்லினம் மிகும்', 'இரட்டைக்கிளவியில் மிகும்'],
                  correctAnswer: 0,
                  explanation: 'இரண்டாம் வேற்றுமை விரி (ஐ உருபு வெளிப்படும் தொடர்களில்) வல்லினம் கட்டாயம் மிகும். எ.கா: பாடத்தைப் படி, நிலவைக் கண்டான்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 2,
      unitNumber: 'அலகு II',
      title: 'சொல்லகராதி',
      tamilTitle: 'அலகு II: சொல்லகராதி',
      questionCount: 15,
      standard: 'பத்தாம் வகுப்புத் தரம்',
      officialTopics: [
        'எதிர்ச்சொல்லை எடுத்தெழுதுதல், ஓரெழுத்து ஒரு மொழி, உரிய பொருளைக் கண்டறிதல்',
        'ஒருபொருள் தரும் பல சொற்கள், பொருந்தா சொல்லைக் கண்டறிதல், அகர வரிசைப்படி சொற்களைச் சீர்செய்தல்',
        'கோடிட்ட இடத்தில் சரியான சொல்லைத் தேர்ந்தெடுத்து எழுதுதல், மரூஉப் பெயர்கள், பேச்சு வழக்கு திருத்தம்',
      ],
      chapters: [
        {
          id: 'gt-u2-c1',
          chapterNumber: 1,
          title: 'சொல் வளம், ஓரெழுத்து ஒருமொழி & அகரவரிசை',
          lessons: [
            {
              id: 'gt-u2-c1-l1',
              lessonNumber: '2.1',
              title: '42 ஓரெழுத்து ஒருமொழிகள் & மரூஉப் பெயர்கள்',
              duration: '35 நிமிடங்கள்',
              keyConcepts: ['நன்னூல் கூறும் 42 ஓரெழுத்து ஒருமொழிகள்', 'ஆ-பசு, மா-பெரிய, கோ-அரசன்', 'மரூஉ: புதுச்சேரி-புதுவை, மயிலாப்பூர்-மயிலை'],
              studyNotes: [
                'நன்னூலார் பவணந்தி முனிவர் தமிழில் 42 ஓரெழுத்து ஒருமொழிகள் உள்ளதாகக் குறிப்பிடுகிறார் (நோ, து ஆகிய இரண்டும் மட்டுமே குறில்; ஏனைய 40 நெடில்கள்).',
                'மரூஉ என்பது இலக்கண நெறியிலிருந்து மருவி வழங்கும் சொற்கள்: உதகை (உதகமண்டலம்), புதுவை (புதுச்சேரி), குடந்தை (கும்பகோணம்).',
              ],
              practiceQuestions: [
                {
                  id: 'gt-q3',
                  question: '"மா" என்னும் ஓரெழுத்து ஒருமொழி தரும் பொருள்களுள் பொருந்தாதது எது?',
                  options: ['பெரிய', 'குதிரை', 'அரசன்', 'விலங்கு'],
                  correctAnswer: 2,
                  explanation: '"மா" என்றால் பெரிய, குதிரை, விலங்கு, அழகு முதலிய பொருள்களைத் தரும். "அரசன்" என்பதைக் குறிக்கும் ஓரெழுத்து ஒருமொழி "கோ" ஆகும்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 3,
      unitNumber: 'அலகு III',
      title: 'எழுதும் திறன்',
      tamilTitle: 'அலகு III: எழுதும் திறன்',
      questionCount: 15,
      standard: 'பத்தாம் வகுப்புத் தரம்',
      officialTopics: [
        'சொற்களை ஒழுங்குபடுத்திச் சொற்றொடர் அமைத்தல் – செய்வினை, செயப்பாட்டு வினை – தன்வினை, பிறவினை',
        'மரபுத் தமிழ்: திணை மரபு, பால் மரபு, காலம், இளமைப் பெயர், ஒலிமரபு, வினைமரபு, தொகை மரபு, நிறுத்தற்குறிகள்',
      ],
      chapters: [
        {
          id: 'gt-u3-c1',
          chapterNumber: 1,
          title: 'வினை வகைகள் மற்றும் தமிழ் மரபுத் தொடர்கள்',
          lessons: [
            {
              id: 'gt-u3-c1-l1',
              lessonNumber: '3.1',
              title: 'செய்வினை-செயப்பாட்டு வினை, இளமைப் பெயர்கள் & ஒலி மரபுகள்',
              duration: '35 நிமிடங்கள்',
              keyConcepts: ['செய்வினை (எழுவாய்+செயப்படுபொருள்+வினை)', 'செயப்பாட்டு வினை (படு, பட்டது)', 'மரபு: நாய் குரைக்கும், யானை பிளிரும், சிங்கம் முழங்கும்'],
              studyNotes: [
                'ஒலி மரபுகள்: குயில் கூவும், மயில் அகவும், ஆந்தை அலறும், காகம் கரையும், சிங்கம் முழங்கும், குதிரை கனைக்கும்.',
                'இளமைப் பெயர்கள்: பசு - கன்று; ஆடு - குட்டி; சிங்கம் - குருளை; புலி - பறழ்; யானை - கன்று; மான் - கன்று.',
                'வினை மரபுகள்: சோறு உண், கூடை முடை, தண்ணீர் குடி, பால் பருகு, பூப்பறி, சுவர் எழுப்பு.',
              ],
              practiceQuestions: [
                {
                  id: 'gt-q4',
                  question: 'விலங்குகளின் இளமைப் பெயர்களில் சரியான மரபுச் சொல் இணையைத் தேர்க:',
                  options: ['புலி - குருளை', 'சிங்கம் - கன்று', 'புலி - பறழ்', 'ஆடு - கன்று'],
                  correctAnswer: 2,
                  explanation: 'புலியின் இளமைப் பெயர் "பறழ்" ஆகும் (புலிப்பறழ்). சிங்கத்தின் இளமைப்பெயர் "குருளை".',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 4,
      unitNumber: 'அலகு IV',
      title: 'கலைச் சொற்கள்',
      tamilTitle: 'அலகு IV: கலைச் சொற்கள்',
      questionCount: 10,
      standard: 'பத்தாம் வகுப்புத் தரம்',
      officialTopics: [
        'பல்துறை சார்ந்த கலைச் சொற்கள் (அறிவியல், கல்வி, மருத்துவம், மேலாண்மை, சட்டம், புவியியல், தொழில்நுட்பம், ஊடகம், தகவல் தொழில்நுட்பம்)',
      ],
      chapters: [
        {
          id: 'gt-u4-c1',
          chapterNumber: 1,
          title: 'அறிவியல், கணினி & நிருவாகக் கலைச்சொற்கள்',
          lessons: [
            {
              id: 'gt-u4-c1-l1',
              lessonNumber: '4.1',
              title: 'பாடநூல் கலைச்சொற்கள் களஞ்சியம்',
              duration: '30 நிமிடங்கள்',
              keyConcepts: ['Search engine - தேடுபொறி', 'Gene - மரபணு', 'Allergy - ஒவ்வாமை', 'Migration - வலசை', 'Nautical Mile - கடல் மைல்'],
              studyNotes: [
                'Search engine: தேடுபொறி; Artificial Intelligence: செயற்கை நுண்ணறிவு; Software: மென்பொருள்; Hardware: வன்பொருள்.',
                'Gene: மரபணு; Allergy: ஒவ்வாமை; Migration: வலசை போதல்; Launch vehicle: ஏவூர்தி; Bio-technology: உயிரித் தொழில்நுட்பம்.',
              ],
              practiceQuestions: [
                {
                  id: 'gt-q5',
                  question: '"Migration" என்னும் ஆங்கிலக் கலைச்சொல்லிற்கு இணையான சரியான தமிழ்ச்சொல் எது?',
                  options: ['இடப்பெயர்வு / வலசை', 'குடியேற்றம்', 'சுற்றுலா', 'பயணம்'],
                  correctAnswer: 0,
                  explanation: 'பறவைகள் மற்றும் உயிரினங்களின் பருவநிலை சார்ந்த இடம்பெயர்வுக்கு "வலசை போதல்" அல்லது "இடப்பெயர்வு" என்பது சரியான சொல்லாகும்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 5,
      unitNumber: 'அலகு V',
      title: 'வாசித்தல் – புரிந்து கொள்ளும் திறன்',
      tamilTitle: 'அலகு V: வாசித்தல் – புரிந்து கொள்ளும் திறன்',
      questionCount: 15,
      standard: 'பத்தாம் வகுப்புத் தரம்',
      officialTopics: [
        'கொடுக்கப்பட்ட பத்தியிலிருந்து வினாக்களுக்கு விடையளித்தல் (செய்தித்தாள் தலையங்கம், முகப்புச் செய்திகள், கட்டுரைகள்)',
        'உவமைத் தொடரின் பொருளறிதல், மரபுத் தொடரின் பொருளறிதல், பழமொழிகள்',
      ],
      chapters: [
        {
          id: 'gt-u5-c1',
          chapterNumber: 1,
          title: 'பத்தி வினாக்கள், உவமை மற்றும் மரபுத்தொடர்கள்',
          lessons: [
            {
              id: 'gt-u5-c1-l1',
              lessonNumber: '5.1',
              title: 'உவமைத் தொடர் பொருளறிதல் & பத்தி விடை நுட்பங்கள்',
              duration: '30 நிமிடங்கள்',
              keyConcepts: ['இஞ்சி தின்ற குரங்கு போல - விழித்தல்', 'மடைதிறந்த வெள்ளம் போல - தடையின்றி பாய்தல்', 'தாமரை இலைத் தண்ணீர் போல - பற்றற்று இருத்தல்'],
              studyNotes: [
                'உவமைத் தொடர்களின் பயன்பாடு: "கிணற்றுத் தவளை போல" என்பது அறியாமை அல்லது உலகியல் அறிவு இல்லாதிருத்தலைக் குறிக்கும்.',
                '"அத்தி பூத்தாற்போல" என்பது மிக அரிதாக நடக்கும் செயலைக் குறிக்கும்.',
                '"தாமரை இலைத் தண்ணீர் போல" என்பது ஒட்டாமல் பற்றற்று இருத்தலைக் குறிக்கும்.',
              ],
              practiceQuestions: [
                {
                  id: 'gt-q6',
                  question: '"அத்தி பூத்தாற் போல" என்னும் உவமைத் தொடர் உணர்த்தும் பொருள் யாது?',
                  options: ['அரிதான செயல்', 'எளிதான செயல்', 'தொடர்ச்சியான நிகழ்வு', 'பயனற்ற செயல்'],
                  correctAnswer: 0,
                  explanation: '"அத்தி பூத்தாற்போல" என்பது அரிதாக அல்லது மிகவும் எப்போதாவது காணப்பெறும் நிகழ்வைக் குறிக்கும்.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 6,
      unitNumber: 'அலகு VI',
      title: 'எளிய மொழி பெயர்ப்பு',
      tamilTitle: 'அலகு VI: எளிய மொழி பெயர்ப்பு',
      questionCount: 5,
      standard: 'பத்தாம் வகுப்புத் தரம்',
      officialTopics: [
        'ஆங்கிலம் மற்றும் பிறமொழிச் சொற்களுக்கு இணையான தமிழ்ச் சொற்கள் அறிதல்',
        'பயன்பாட்டில் உள்ள ஆங்கிலச் சொற்களை மொழிபெயர்த்தல் (pendrive, printer, computer, keyboard போன்றவை)',
      ],
      chapters: [
        {
          id: 'gt-u6-c1',
          chapterNumber: 1,
          title: 'நாள்தோறும் பயன்பாட்டு மொழிபெயர்ப்பு',
          lessons: [
            {
              id: 'gt-u6-c1-l1',
              lessonNumber: '6.1',
              title: 'அலுவலகச் சாதனங்கள் மற்றும் ஆவணப் பெயர்கள் மொழிபெயர்ப்பு',
              duration: '25 நிமிடங்கள்',
              keyConcepts: ['Computer - கணினி', 'Keyboard - விசைப்பலகை', 'Pendrive - விரலி / நினைவகம்', 'Printer - அச்சுப்பொறி'],
              studyNotes: [
                'கணினி சார்ந்த மொழிபெயர்ப்பு: Pendrive = விரலி (விரலி நினைவகம்); Printer = அச்சுப்பொறி; Scanner = வருடி; Screen = திரை.',
                'அரசு ஆவணங்கள்: File = கோப்பு; Circular = சுற்றறிக்கை; Order = ஆணை; Application = விண்ணப்பம்.',
              ],
              practiceQuestions: [
                {
                  id: 'gt-q7',
                  question: '"Pendrive" என்னும் சொல்லுக்கு இணையான சரியான தமிழ்ச்சொல் எது?',
                  options: ['விரலி', 'சுட்டி', 'விசைப்பலகை', 'அச்சுப்பொறி'],
                  correctAnswer: 0,
                  explanation: '"Pendrive" என்பது விரலி நினைவகம் அல்லது விரலி என்று தமிழில் அழைக்கப்படுகிறது.',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 7,
      unitNumber: 'அலகு VII',
      title: 'இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்',
      tamilTitle: 'அலகு VII: இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்',
      questionCount: 15,
      standard: 'பத்தாம் வகுப்புத் தரம் (பாடப் புத்தகங்கள்)',
      officialTopics: [
        'திருக்குறள் தொடர்பான செய்திகள் (இருபது அதிகாரங்கள் மட்டும்: ஒழுக்கமுடைமை, பொறையுடைமை, ஊக்கமுடைமை, விருந்தோம்பல், அறன் வலியுறுத்தல், ஈகை, பெரியாரைத் துணைக்கோடல், வினை செயல்வகை, அவையஞ்சாமை, கண்ணோட்டம், அன்புடைமை, கல்வி, நடுநிலைமை, கூடா ஒழுக்கம், கல்லாமை, செங்கோன்மை, பண்புடைமை, நட்பாராய்தல், புறங்கூறாமை, அருளுடைமை)',
        'அறநூல் தொடர்பான செய்திகள்: நாலடியார், நான்மணிக்கடிகை, பழமொழி நானூறு, முதுமொழிக்காஞ்சி, திரிகடுகம், இன்னாநாற்பது, சிறுபஞ்சமூலம், ஏலாதி, அவ்வையார் பாடல்கள்',
        'தமிழ் அறிஞர்களும் தமிழ்த்தொண்டும்: உ.வே.சா, பரிதிமாற்கலைஞர், தேவநேயப் பாவாணர், பாவலரேறு பெருஞ்சித்திரனார், ஜி.யு.போப், வீரமாமுனிவர், பாரதிதாசன், கண்ணதாசன், வேலுநாச்சியார் உள்ளிட்டோர்',
      ],
      chapters: [
        {
          id: 'gt-u7-c1',
          chapterNumber: 1,
          title: 'திருக்குறள், அறநூல்கள் மற்றும் தமிழ்ச் சான்றோர்கள்',
          lessons: [
            {
              id: 'gt-u7-c1-l1',
              lessonNumber: '7.1',
              title: 'திருக்குறள் 20 அதிகாரங்கள், பதினெண்கீழ்க்கணக்கு & தமிழ் அறிஞர்கள்',
              duration: '50 நிமிடங்கள்',
              keyConcepts: [
                'திருக்குறள் (1330 குறள்கள், 133 அதிகாரங்கள்)',
                'நாலடியார் (சமண முனிவர்கள்)',
                'உ.வே.சா (தமிழ் தாத்தா - ஏட்டுச் சுவடி பதிப்பு)',
                'வீரமாமுனிவர் (தேம்பாவணி, சதுரகராதி)',
                'ஜி.யு.போப் (திருக்குறள் & திருவாசகம் ஆங்கில மொழிபெயர்ப்பு)',
              ],
              studyNotes: [
                'பாடத்திட்டத்தில் குறிப்பிடப்பட்டுள்ள 20 திருக்குறள் அதிகாரங்கள்: ஒழுக்கமுடைமை, பொறையுடைமை, ஊக்கமுடைமை, விருந்தோம்பல், அறன் வலியுறுத்தல், ஈகை, பெரியாரைத் துணைக்கோடல், வினை செயல்வகை, அவையஞ்சாமை, கண்ணோட்டம், அன்புடைமை, கல்வி, நடுநிலைமை, கூடா ஒழுக்கம், கல்லாமை, செங்கோன்மை, பண்புடைமை, நட்பாராய்தல், புறங்கூறாமை, அருளுடைமை.',
                'பதினெண்கீழ்க்கணக்கு அறநூல்கள்: நாலடியார் (நாலும் இரண்டும் சொல்லுக்குறுதி - சமண முனிவர்கள்), திரிகடுகம் (நல்லாதனார் - சுக்கு, மிளகு, திப்பிலி), ஏலாதி & சிறுபஞ்சமூலம் (மருந்துப் பெயர்கள் அமைந்த நூல்கள்).',
                'உ.வே.சாமிநாதையர் ஓலைச்சுவடிகளைத் தேடித் தேடி அச்சுவாகனமேற்றிப் பதிப்பித்ததால் "தமிழ்த்தாத்தா" எனப் போற்றப்படுகிறார்.',
                'ஜி.யு.போப் திருக்குறளையும் திருவாசகத்தையும் ஆங்கிலத்தில் மொழிபெயர்த்தார்; தம் கல்லறையில் "ஒரு தமிழ் மாணவன் உறங்குகிறான்" என எழுதப் பணித்தார்.',
              ],
              practiceQuestions: [
                {
                  id: 'gt-q8',
                  question: 'திருக்குறளை ஆங்கிலத்தில் முழுமையாக மொழிபெயர்த்து வெளியிட்ட மேலைநாட்டுத் தமிழறிஞர் யார்?',
                  options: ['வீரமாமுனிவர்', 'ஜி.யு.போப்', 'கால்டுவெல்', 'சீகன் பால்கு'],
                  correctAnswer: 1,
                  explanation: 'ஜி.யு.போப் (G.U. Pope) திருக்குறள் மற்றும் திருவாசகத்தை ஆங்கிலத்தில் மொழிபெயர்த்து உலகறியச் செய்தார்.',
                },
                {
                  id: 'gt-q9',
                  question: 'சுக்கு, மிளகு, திப்பிலி ஆகிய மூன்று மருந்துப் பொருள்களால் மனிதனின் உடற்பிணி தீர்வது போல, மும்மூன்று நீதிகளால் மனப்பிணி தீர்க்கும் நூல் எது?',
                  options: ['சிறுபஞ்சமூலம்', 'திரிகடுகம்', 'ஏலாதி', 'ஆசாரக்கோவை'],
                  correctAnswer: 1,
                  explanation: 'நல்லாதனார் இயற்றிய "திரிகடுகம்" சுக்கு, மிளகு, திப்பிலி ஆகிய மூவகை மருந்துகளால் அறியாமை நீக்கும் நீதிகளைக் கூறுகிறது.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

// -------------------------------------------------------------
// The 4 official Subject Sections in exact order:
// 1. General Studies
// 2. Aptitude
// 3. General English
// 4. General Tamil
// -------------------------------------------------------------
export const group2Subjects: Group2Subject[] = [
  generalStudiesSubject,
  aptitudeSubject,
  generalEnglishSubject,
  generalTamilSubject,
]

export const getGroup2SubjectById = (id: string): Group2Subject | undefined => {
  return group2Subjects.find((s) => s.id === id)
}

export const getGroup2UnitById = (subjectId: string, unitId: number): Group2Unit | undefined => {
  const subject = getGroup2SubjectById(subjectId)
  if (!subject) return undefined
  return subject.units.find((u) => u.id === unitId)
}

export const getGroup2UnitChapterCount = (unit: Group2Unit): number => {
  return unit.chapters.length
}

export const getGroup2UnitLessonCount = (unit: Group2Unit): number => {
  return unit.chapters.reduce((acc, c) => acc + c.lessons.length, 0)
}

export const getTotalGroup2SubjectChapters = (subject: Group2Subject): number => {
  return subject.units.reduce((acc, u) => acc + u.chapters.length, 0)
}

export const getTotalGroup2SubjectLessons = (subject: Group2Subject): number => {
  return subject.units.reduce(
    (acc, u) => acc + u.chapters.reduce((cAcc, c) => cAcc + c.lessons.length, 0),
    0
  )
}

export const getTotalGroup2Questions = (): number => {
  return group2Subjects.reduce((acc, s) => acc + s.questionCount, 0)
}

