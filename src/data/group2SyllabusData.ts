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

import { group2GeneralTamilUnits } from './generalTamilComprehensiveData'
import { group2GeneralEnglishUnits } from './generalEnglishComprehensiveData'

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
  partTag: 'Part A • Degree Standard',
  standard: 'Degree Standard',
  questionCount: 75,
  description:
    'Covers General Science, Geography of India, History, Culture of India & National Movement, Indian Polity, Indian Economy & TN Development, and Tamil Society Heritage.',
  accentColor: '#38bdf8',
  units: [
    {
      id: 1,
      unitNumber: 'Unit 1',
      title: 'General Science',
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
      unitNumber: 'Unit 2',
      title: 'Geography of India',
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
      unitNumber: 'Unit 3',
      title: 'History, Culture of India & National Movement',
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
      unitNumber: 'Unit 4',
      title: 'Indian Polity',
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
      unitNumber: 'Unit 5',
      title: 'Indian Economy & Development Administration in Tamil Nadu',
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
      unitNumber: 'Unit 6',
      title: 'History, Culture, Heritage & Socio-Political Movements in TN',
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
  partTag: 'Part B • SSLC Standard',
  standard: 'SSLC Standard (10th Standard)',
  questionCount: 25,
  description:
    'Covers Quantitative Aptitude (Simplification, Percentage, HCF & LCM, Ratio, Simple & Compound Interest, Area, Volume, Time & Work) and Mental Ability (Logical Reasoning, Puzzles, Dice, Visual & Alpha-numeric Reasoning).',
  accentColor: '#fbbf24',
  units: [
    {
      id: 1,
      unitNumber: 'Unit 1',
      title: 'Aptitude',
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
      unitNumber: 'Unit 2',
      title: 'Reasoning',
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
  partTag: 'Part C • SSLC Standard',
  standard: 'SSLC Standard (10th Standard)',
  questionCount: 100,
  description:
    'Complete SSLC language syllabus consisting of Grammar (25 Qs), Vocabulary (15 Qs), Writing Skills (10 Qs), Technical Terms (10 Qs), Reading Comprehension (20 Qs), Translation (5 Qs), and Literary Works (15 Qs).',
  accentColor: '#ec4899',
  units: group2GeneralEnglishUnits,
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
  units: group2GeneralTamilUnits,
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

